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
    mapping(bytes32 => bool) public approvedIntents; // on-chain onay (sendTransaction yolu)

    event AutoPaymentExecuted(address indexed agent, address indexed to, uint256 amount, bytes32 reasonHash);
    event ApprovedPaymentExecuted(address indexed agent, address indexed to, uint256 amount, uint256 nonce, bytes32 reasonHash);
    event IntentApprovedOnchain(bytes32 indexed intentHash, address indexed owner);
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
    error IntentNotApproved();

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

    // ───────────── ON-CHAIN ONAY YOLU (sendTransaction — World App testnette imza desteklemiyor) ─────────────
    /// @notice Owner (World App hesabı) intent'i zincirde onaylar. Mini App sendTransaction ile çağırır.
    /// @dev World App smart account'u testnette deploy'lu olmadığından off-chain imza doğrulanamıyor;
    ///      onay doğrudan on-chain durum olarak tutuluyor. msg.sender == owner (sponsorlu userOp).
    function approveIntent(PaymentIntent calldata i) external onlyOwner {
        bytes32 h = hashIntent(i);
        approvedIntents[h] = true;
        emit IntentApprovedOnchain(h, msg.sender);
    }

    /// @notice Ajan, owner'ın on-chain onayladığı intent'i öder (imza yok).
    function executeApprovedPaymentOnchain(PaymentIntent calldata i) external onlyAgent {
        if (i.agent != msg.sender) revert WrongAgent();
        if (block.timestamp > i.deadline) revert IntentExpired();
        if (usedNonces[i.nonce]) revert NonceUsed();
        if (!approvedIntents[hashIntent(i)]) revert IntentNotApproved();
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
