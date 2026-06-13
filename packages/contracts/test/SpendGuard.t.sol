// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {SpendGuard} from "../src/SpendGuard.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract MockERC1271 { // World App cüzdanını simüle eder
    address public immutable signer;
    constructor(address _signer) { signer = _signer; }
    function isValidSignature(bytes32 hash, bytes calldata sig) external view returns (bytes4) {
        (address rec,,) = ECDSA.tryRecover(hash, sig);
        return rec == signer ? bytes4(0x1626ba7e) : bytes4(0xffffffff);
    }
}

contract SpendGuardTest is Test {
    MockUSDC usdc;
    SpendGuard guard;
    address agent; uint256 agentPk;
    address ownerEoa; uint256 ownerPk;
    address seller = makeAddr("seller");
    address evil = makeAddr("evil");

    function setUp() public {
        (agent, agentPk) = makeAddrAndKey("agent");
        (ownerEoa, ownerPk) = makeAddrAndKey("owner");
        usdc = new MockUSDC();
        address[] memory wl = new address[](1); wl[0] = seller;
        guard = new SpendGuard(ownerEoa, agent, usdc, 1e6, 10e6, wl); // $1 / $10
        usdc.mint(address(guard), 200e6);
    }

    function _intent(uint256 amount, uint256 nonce) internal view returns (SpendGuard.PaymentIntent memory) {
        return SpendGuard.PaymentIntent(seller, amount, nonce, block.timestamp + 300, keccak256("Q2 verisi"), agent);
    }
    function _sign(uint256 pk, SpendGuard.PaymentIntent memory i) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, guard.hashIntent(i));
        return abi.encodePacked(r, s, v);
    }

    function test_AutoPayment_OK() public {
        vm.prank(agent); guard.executePayment(seller, 0.05e6, keccak256("api"));
        assertEq(usdc.balanceOf(seller), 0.05e6);
    }
    function test_AutoPayment_RevertNotWhitelisted() public {
        vm.prank(agent); vm.expectRevert(SpendGuard.NotWhitelisted.selector);
        guard.executePayment(evil, 0.05e6, "");
    }
    function test_AutoPayment_RevertPerTx() public {
        vm.prank(agent); vm.expectRevert(SpendGuard.PerTxLimitExceeded.selector);
        guard.executePayment(seller, 2e6, "");
    }
    function test_AutoPayment_DailyLimitWindow() public {
        for (uint i; i < 10; ++i) { vm.prank(agent); guard.executePayment(seller, 1e6, ""); }
        vm.prank(agent); vm.expectRevert(SpendGuard.DailyLimitExceeded.selector);
        guard.executePayment(seller, 1e6, "");
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(agent); guard.executePayment(seller, 1e6, ""); // pencere sıfırlandı
    }
    function test_Approved_EOAOwner_OK() public {
        SpendGuard.PaymentIntent memory i = _intent(80e6, 1);
        bytes memory sig = _sign(ownerPk, i); // prank'tan ÖNCE imzala (hashIntent view çağrısı prank'ı tüketir)
        vm.prank(agent); guard.executeApprovedPayment(i, sig);
        assertEq(usdc.balanceOf(seller), 80e6);
    }
    function test_Approved_1271Owner_OK() public { // WORLD APP SENARYOSU
        MockERC1271 sc = new MockERC1271(ownerEoa);
        vm.prank(ownerEoa); guard.transferOwnership(address(sc));
        SpendGuard.PaymentIntent memory i = _intent(80e6, 2);
        bytes memory sig = _sign(ownerPk, i);
        vm.prank(agent); guard.executeApprovedPayment(i, sig);
        assertEq(usdc.balanceOf(seller), 80e6);
    }
    function test_Approved_RevertBadSig() public {
        SpendGuard.PaymentIntent memory i = _intent(80e6, 3);
        (address rnd, uint256 rndPk) = makeAddrAndKey("rnd"); rnd;
        bytes memory sig = _sign(rndPk, i);
        vm.prank(agent); vm.expectRevert(SpendGuard.InvalidOwnerSignature.selector);
        guard.executeApprovedPayment(i, sig);
    }
    function test_Approved_RevertReplay() public {
        SpendGuard.PaymentIntent memory i = _intent(80e6, 4);
        bytes memory sig = _sign(ownerPk, i);
        vm.startPrank(agent);
        guard.executeApprovedPayment(i, sig);
        vm.expectRevert(SpendGuard.NonceUsed.selector);
        guard.executeApprovedPayment(i, sig);
        vm.stopPrank();
    }
    function test_OnchainApprove_OK() public {
        SpendGuard.PaymentIntent memory i = _intent(80e6, 10);
        vm.prank(ownerEoa); guard.approveIntent(i);
        vm.prank(agent); guard.executeApprovedPaymentOnchain(i);
        assertEq(usdc.balanceOf(seller), 80e6);
    }
    function test_OnchainApprove_RevertNotApproved() public {
        SpendGuard.PaymentIntent memory i = _intent(80e6, 11);
        vm.prank(agent); vm.expectRevert(SpendGuard.IntentNotApproved.selector);
        guard.executeApprovedPaymentOnchain(i);
    }
    function test_OnchainApprove_RevertNotOwner() public {
        SpendGuard.PaymentIntent memory i = _intent(80e6, 12);
        vm.prank(evil); vm.expectRevert(SpendGuard.NotOwner.selector);
        guard.approveIntent(i);
    }

    function test_Approved_RevertExpired() public {
        SpendGuard.PaymentIntent memory i = _intent(80e6, 5);
        bytes memory sig = _sign(ownerPk, i);
        vm.warp(block.timestamp + 301);
        vm.prank(agent); vm.expectRevert(SpendGuard.IntentExpired.selector);
        guard.executeApprovedPayment(i, sig);
    }
}
