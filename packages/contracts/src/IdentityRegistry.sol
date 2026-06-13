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
