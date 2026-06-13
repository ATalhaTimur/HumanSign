// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Script, console2} from "forge-std/Script.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

/// @notice Ajan kendini ERC-8004 IdentityRegistry'ye kaydeder (agent-card.json → base64 data URI).
/// Kayıt AJAN tarafından yapılır (anlatı: ajanın kimliği kendi cüzdanından doğar).
contract Register8004 is Script {
    function run() external {
        string memory json = vm.readFile("./agent-card.json"); // adresler doldurulmuş 8004 kartı
        string memory uri = string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
        vm.startBroadcast(vm.envUint("AGENT_PRIVATE_KEY"));
        uint256 id = IdentityRegistry(vm.envAddress("IDENTITY_REGISTRY_ADDRESS")).register(uri);
        vm.stopBroadcast();
        console2.log("agentId:", id);
    }
}
