// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MonadPixelFarmBadge
/// @notice Soulbound ERC721 badges representing course completion achievements.
/// @dev Badges are non-transferable (soulbound) to preserve their meaning as
///      verifiable learning achievements. Each badge type maps to a course.
///      Each user may hold at most one badge of each type.
///      Only authorized minters (platform backend) can mint badges.
contract MonadPixelFarmBadge is ERC721URIStorage, Ownable {
    // --- Types ---

    struct BadgeType {
        string name;
        string description;
        string uri;
        bool exists;
    }

    // --- State ---

    // badgeTypeId => BadgeType
    mapping(uint256 => BadgeType) public badgeTypes;
    // address => whether authorized as minter
    mapping(address => bool) public minters;

    // tokenId => badgeTypeId
    mapping(uint256 => uint256) public tokenBadgeType;
    // owner => badgeTypeId => whether they hold this badge
    mapping(address => mapping(uint256 => bool)) public hasBadge;
    // owner => list of tokenIds (append-only, safe because soulbound)
    mapping(address => uint256[]) private _ownerTokens;

    uint256 public nextTokenId;
    uint256 public nextBadgeTypeId;

    // --- Events ---

    event BadgeTypeCreated(uint256 indexed typeId, string name, string uri);
    event BadgeMinted(uint256 indexed tokenId, uint256 indexed typeId, address indexed to);
    event MinterUpdated(address indexed account, bool isMinter);

    // --- Errors ---

    error BadgeTypeNotFound(uint256 typeId);
    error NotAuthorizedMinter(address caller);
    error EmptyName();
    error ZeroLengthArray();
    error ArrayMismatch();
    error SoulboundToken();
    error AlreadyHasBadge(address owner, uint256 typeId);

    // --- Constructor ---

    constructor(string memory name_, string memory symbol_) ERC721(name_, symbol_) Ownable(msg.sender) {}

    // --- Modifiers ---

    modifier onlyMinter() {
        if (!minters[msg.sender] && msg.sender != owner()) {
            revert NotAuthorizedMinter(msg.sender);
        }
        _;
    }

    // --- Badge type management ---

    /// @notice Create a single badge type.
    /// @param name Display name of the badge type
    /// @param description Human-readable description of what the badge represents
    /// @param uri Metadata URI (e.g. IPFS or Arweave) for the badge artwork
    /// @return typeId The ID of the newly created badge type
    function createBadgeType(
        string memory name,
        string memory description,
        string memory uri
    ) external onlyOwner returns (uint256) {
        if (bytes(name).length == 0) revert EmptyName();
        uint256 typeId = nextBadgeTypeId++;
        badgeTypes[typeId] = BadgeType({name: name, description: description, uri: uri, exists: true});
        emit BadgeTypeCreated(typeId, name, uri);
        return typeId;
    }

    /// @notice Batch create multiple badge types in one transaction.
    /// @param names Array of badge type names
    /// @param descriptions Array of badge type descriptions
    /// @param uris Array of badge type metadata URIs
    function createBadgeTypes(
        string[] calldata names,
        string[] calldata descriptions,
        string[] calldata uris
    ) external onlyOwner returns (uint256[] memory typeIds) {
        if (names.length == 0) revert ZeroLengthArray();
        if (names.length != descriptions.length || names.length != uris.length) revert ArrayMismatch();

        typeIds = new uint256[](names.length);
        for (uint256 i = 0; i < names.length; i++) {
            if (bytes(names[i]).length == 0) revert EmptyName();
            typeIds[i] = nextBadgeTypeId;
            badgeTypes[nextBadgeTypeId] = BadgeType({
                name: names[i],
                description: descriptions[i],
                uri: uris[i],
                exists: true
            });
            emit BadgeTypeCreated(nextBadgeTypeId, names[i], uris[i]);
            nextBadgeTypeId++;
        }
    }

    // --- Minter management ---

    /// @notice Grant or revoke minter role.
    /// @param account Address to update
    /// @param isMinter_ True to grant, false to revoke
    function setMinter(address account, bool isMinter_) external onlyOwner {
        minters[account] = isMinter_;
        emit MinterUpdated(account, isMinter_);
    }

    // --- Minting ---

    /// @notice Mint a badge to a recipient.
    /// @param to Recipient address
    /// @param typeId Badge type to mint
    /// @return tokenId The ID of the newly minted token
    /// @dev Reverts if the recipient already holds a badge of this type.
    function mint(address to, uint256 typeId) external onlyMinter returns (uint256) {
        BadgeType storage bt = badgeTypes[typeId];
        if (!bt.exists) revert BadgeTypeNotFound(typeId);
        if (hasBadge[to][typeId]) revert AlreadyHasBadge(to, typeId);

        uint256 tokenId = nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, bt.uri);

        tokenBadgeType[tokenId] = typeId;
        hasBadge[to][typeId] = true;
        _ownerTokens[to].push(tokenId);

        emit BadgeMinted(tokenId, typeId, to);
        return tokenId;
    }

    // --- Badge type & token URI management ---

    /// @notice Update the metadata URI template for a badge type.
    /// @param typeId Badge type to update
    /// @param newUri New metadata URI
    /// @dev Only affects future mints. Already-minted tokens keep their existing URI
    ///      unless explicitly updated via updateTokenURI.
    function updateBadgeTypeURI(uint256 typeId, string calldata newUri) external onlyOwner {
        BadgeType storage bt = badgeTypes[typeId];
        if (!bt.exists) revert BadgeTypeNotFound(typeId);
        bt.uri = newUri;
    }

    /// @notice Update the metadata URI of an already-minted token.
    /// @param tokenId Token to update
    /// @param newUri New metadata URI
    /// @dev Emits ERC4906 MetadataUpdate event so marketplaces refresh the metadata.
    function updateTokenURI(uint256 tokenId, string calldata newUri) external onlyOwner {
        _setTokenURI(tokenId, newUri);
    }

    // --- Soulbound enforcement ---

    /// @notice Override _update to prevent transfers of existing tokens.
    /// @dev Only minting (from == address(0)) and burning (to == address(0)) are allowed.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = super._update(to, tokenId, auth);
        if (from != address(0) && to != address(0)) revert SoulboundToken();
        return from;
    }

    // --- Queries ---

    /// @notice Get badge type metadata.
    function getBadgeType(
        uint256 typeId
    ) external view returns (string memory name, string memory description, string memory uri) {
        BadgeType storage bt = badgeTypes[typeId];
        if (!bt.exists) revert BadgeTypeNotFound(typeId);
        return (bt.name, bt.description, bt.uri);
    }

    /// @notice Get all token IDs owned by an address.
    /// @param owner Address to query
    /// @return Array of token IDs
    function tokensOfOwner(address owner) external view returns (uint256[] memory) {
        return _ownerTokens[owner];
    }
}