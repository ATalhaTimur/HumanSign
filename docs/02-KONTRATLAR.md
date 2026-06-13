# 02 · AKILLI KONTRATLAR

> Sahip: Kontrat dev · Bağımlılık: yok (ilk başlayan iş) · Tahmin: 5–7 saat (testler dahil)

## 1. Kurulum

```bash
cd packages/contracts
forge init --no-git .
forge install OpenZeppelin/openzeppelin-contracts
```

`foundry.toml`:
```toml
[profile.default]
solc = "0.8.24"
optimizer = true
remappings = ["@openzeppelin/=lib/openzeppelin-contracts/"]
```

## 2. src/SpendGuard.sol (TAM KOD)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @title HumanSign SpendGuard — ajan harcamaları için 2-of-2 policy kasası
/// @notice Limit altı: yalnız ajan imzası. Limit üstü: ajan + owner'ın EIP-712 onayı.
/// @dev Owner bir World App SMART ACCOUNT'udur → imza doğrulama SignatureChecker (EIP-1271 uyumlu).
contract SpendGuard is EIP712 {
    using SafeERC20 for IERC20;

    struct PaymentIntent {
        address to;
        uint256 amount;
        uint256 nonce;
        uint256 deadline;
        bytes32 reasonHash; // keccak256(utf8(sebep)) — onay kartındaki metinle birebir
        address agent;
    }

    bytes32 public constant PAYMENT_INTENT_TYPEHASH = keccak256(
        "PaymentIntent(address to,uint256 amount,uint256 nonce,uint256 deadline,bytes32 reasonHash,address agent)"
    );

    address public owner;     // World App smart account
    address public agentKey;  // ajanın EOA'sı
    IERC20  public immutable token;

    uint256 public perTxLimit;
    uint256 public dailyLimit;
    uint256 public dailySpent;
    uint256 public dayStart;

    mapping(address => bool) public whitelist;
    mapping(uint256 => bool) public usedNonces;

    event AutoPaymentExecuted(address indexed agent, address indexed to, uint256 amount, bytes32 reasonHash);
    event ApprovedPaymentExecuted(address indexed agent, address indexed to, uint256 amount, uint256 nonce, bytes32 reasonHash);
    event PolicyUpdated(uint256 perTxLimit, uint256 dailyLimit);
    event WhitelistUpdated(address indexed target, bool allowed);
    event AgentKeyUpdated(address indexed newAgent);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error NotAgent();
    error NotWhitelisted();
    error PerTxLimitExceeded();
    error DailyLimitExceeded();
    error InvalidOwnerSignature();
    error NonceUsed();
    error IntentExpired();
    error WrongAgent();

    modifier onlyOwner() { if (msg.sender != owner) revert NotOwner(); _; }
    modifier onlyAgent() { if (msg.sender != agentKey) revert NotAgent(); _; }

    constructor(
        address _owner,
        address _agentKey,
        IERC20 _token,
        uint256 _perTxLimit,
        uint256 _dailyLimit,
        address[] memory initialWhitelist
    ) EIP712("HumanSign", "1") {
        owner = _owner;
        agentKey = _agentKey;
        token = _token;
        perTxLimit = _perTxLimit;
        dailyLimit = _dailyLimit;
        dayStart = block.timestamp;
        for (uint256 i; i < initialWhitelist.length; ++i) {
            whitelist[initialWhitelist[i]] = true;
            emit WhitelistUpdated(initialWhitelist[i], true);
        }
    }

    // ───────────────────── OTONOM YOL (limit altı) ─────────────────────
    function executePayment(address to, uint256 amount, bytes32 reasonHash) external onlyAgent {
        if (!whitelist[to]) revert NotWhitelisted();
        if (amount > perTxLimit) revert PerTxLimitExceeded();
        _rollDayWindow();
        if (dailySpent + amount > dailyLimit) revert DailyLimitExceeded();
        dailySpent += amount;
        token.safeTransfer(to, amount);
        emit AutoPaymentExecuted(msg.sender, to, amount, reasonHash);
    }

    // ───────────────────── ONAYLI YOL (limit üstü) ─────────────────────
    function executeApprovedPayment(PaymentIntent calldata i, bytes calldata ownerSig) external onlyAgent {
        if (i.agent != msg.sender) revert WrongAgent();
        if (block.timestamp > i.deadline) revert IntentExpired();
        if (usedNonces[i.nonce]) revert NonceUsed();

        bytes32 digest = hashIntent(i);
        // KRİTİK: SignatureChecker → EOA ise ecrecover, kontrat ise EIP-1271 isValidSignature.
        if (!SignatureChecker.isValidSignatureNow(owner, digest, ownerSig)) revert InvalidOwnerSignature();

        usedNonces[i.nonce] = true;
        token.safeTransfer(i.to, i.amount);
        emit ApprovedPaymentExecuted(msg.sender, i.to, i.amount, i.nonce, i.reasonHash);
    }

    /// @notice Backend/test tarafının da aynı digest'i hesapladığını doğrulamak için public.
    function hashIntent(PaymentIntent calldata i) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            PAYMENT_INTENT_TYPEHASH, i.to, i.amount, i.nonce, i.deadline, i.reasonHash, i.agent
        )));
    }

    // ───────────────────── YÖNETİM (owner = Mini App sendTransaction) ─────────────────────
    function setPolicy(uint256 _perTxLimit, uint256 _dailyLimit) external onlyOwner {
        perTxLimit = _perTxLimit; dailyLimit = _dailyLimit;
        emit PolicyUpdated(_perTxLimit, _dailyLimit);
    }
    function setWhitelist(address target, bool allowed) external onlyOwner {
        whitelist[target] = allowed; emit WhitelistUpdated(target, allowed);
    }
    function setAgentKey(address newAgent) external onlyOwner {
        agentKey = newAgent; emit AgentKeyUpdated(newAgent);
    }
    function transferOwnership(address newOwner) external onlyOwner {
        emit OwnershipTransferred(owner, newOwner); owner = newOwner;
    }
    function withdraw(uint256 amount) external onlyOwner { token.safeTransfer(owner, amount); }

    // ───────────────────── GÖRÜNÜM ─────────────────────
    function remainingDaily() external view returns (uint256) {
        if (block.timestamp >= dayStart + 1 days) return dailyLimit;
        return dailyLimit > dailySpent ? dailyLimit - dailySpent : 0;
    }

    function _rollDayWindow() internal {
        if (block.timestamp >= dayStart + 1 days) { dayStart = block.timestamp; dailySpent = 0; }
    }
}
```

## 3. src/MockUSDC.sol ve src/IdentityRegistry.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); } // testnet: serbest mint
}
```

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC721URIStorage, ERC721} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/// @notice ERC-8004 Identity Registry'nin minimal, hackathon-dürüst implementasyonu.
/// (Reputation/Validation registry'leri kapsam dışı — README'de belirt.)
contract IdentityRegistry is ERC721URIStorage {
    uint256 public nextId = 1;
    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);

    constructor() ERC721("HumanSign Agents (ERC-8004 min)", "HSAGENT") {}

    function register(string calldata agentURI) external returns (uint256 agentId) {
        agentId = nextId++;
        _mint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);
        emit Registered(agentId, agentURI, msg.sender);
    }

    function setAgentURI(uint256 agentId, string calldata agentURI) external {
        require(ownerOf(agentId) == msg.sender, "NOT_OWNER");
        _setTokenURI(agentId, agentURI);
    }
}
```

## 4. test/SpendGuard.t.sol (kritik testler — TAM KOD)

```solidity
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
        vm.prank(agent); guard.executeApprovedPayment(i, _sign(ownerPk, i));
        assertEq(usdc.balanceOf(seller), 80e6);
    }
    function test_Approved_1271Owner_OK() public { // WORLD APP SENARYOSU
        MockERC1271 sc = new MockERC1271(ownerEoa);
        vm.prank(ownerEoa); guard.transferOwnership(address(sc));
        SpendGuard.PaymentIntent memory i = _intent(80e6, 2);
        vm.prank(agent); guard.executeApprovedPayment(i, _sign(ownerPk, i));
        assertEq(usdc.balanceOf(seller), 80e6);
    }
    function test_Approved_RevertBadSig() public {
        SpendGuard.PaymentIntent memory i = _intent(80e6, 3);
        (address rnd, uint256 rndPk) = makeAddrAndKey("rnd"); rnd;
        vm.prank(agent); vm.expectRevert(SpendGuard.InvalidOwnerSignature.selector);
        guard.executeApprovedPayment(i, _sign(rndPk, i));
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
    function test_Approved_RevertExpired() public {
        SpendGuard.PaymentIntent memory i = _intent(80e6, 5);
        bytes memory sig = _sign(ownerPk, i);
        vm.warp(block.timestamp + 301);
        vm.prank(agent); vm.expectRevert(SpendGuard.IntentExpired.selector);
        guard.executeApprovedPayment(i, sig);
    }
}
```

`forge test -vv` → 9/9 yeşil olmadan deploy YOK.

## 5. script/Deploy.s.sol

```solidity
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
```

`packages/contracts/package.json`:
```json
{ "name": "contracts", "scripts": {
  "build": "forge build", "test": "forge test -vv",
  "deploy:testnet": "forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast && node ./sync-addresses.mjs"
}}
```

`sync-addresses.mjs`: broadcast çıktısındaki adresleri okuyup `packages/shared/addresses.ts` + kök `.env`'e yazar (10 satırlık dosya — broadcast/Deploy.s.sol/4801/run-latest.json içinden `contractAddress` alanlarını sırayla çek).

## 6. Deploy Sonrası Kontrol Listesi

- [ ] Explorer'da 3 kontrat doğrulanmış görünüyor (`forge verify-contract` opsiyonel, vakit varsa)
- [ ] `cast call $SPEND_GUARD "remainingDaily()(uint256)"` → 10000000
- [ ] `cast call $SPEND_GUARD "whitelist(address)(bool)" $SELLER_ADDRESS` → true
- [ ] Dev Portal → Contract Entrypoints'e SpendGuard adresi eklendi
- [ ] Adresler `shared/addresses.ts`'e düştü, backend/agent import edebiliyor
