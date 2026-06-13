// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Script, console2} from "forge-std/Script.sol";
import {SpendGuard} from "../src/SpendGuard.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";

contract Deploy is Script {
    function run() external {
        address ownerAddr = vm.envAddress("OWNER_ADDRESS");
        address agentAddr = vm.addr(vm.envUint("AGENT_PRIVATE_KEY"));
        address sellerAddr = vm.envAddress("SELLER_ADDRESS");

        vm.startBroadcast(vm.envUint("DEPLOYER_PRIVATE_KEY"));
        MockUSDC usdc = new MockUSDC();
        address[] memory wl = new address[](1); wl[0] = sellerAddr;
        SpendGuard guard = new SpendGuard(ownerAddr, agentAddr, usdc, 1e6, 10e6, wl);
        IdentityRegistry reg = new IdentityRegistry();
        usdc.mint(address(guard), 200e6);              // kasayı doldur
        payable(agentAddr).transfer(0.02 ether);       // ajana gas
        vm.stopBroadcast();

        console2.log("MOCK_USDC_ADDRESS=", address(usdc));
        console2.log("SPEND_GUARD_ADDRESS=", address(guard));
        console2.log("IDENTITY_REGISTRY_ADDRESS=", address(reg));
    }
}
