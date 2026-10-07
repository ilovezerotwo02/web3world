// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/NFTBadge.sol";

contract MonadPixelFarmBadgeTest is Test {
    MonadPixelFarmBadge public badge;
    address public owner = address(0x100);
    address public minter = address(0x200);
    address public user1 = address(0x301);
    address public user2 = address(0x302);
    address public attacker = address(0x999);

    string constant NAME = "Monad Pixel Farm Badge";
    string constant SYMBOL = "MPFB";

    function setUp() public {
        vm.prank(owner);
        badge = new MonadPixelFarmBadge(NAME, SYMBOL);
    }

    // ============================================================
    // Constructor
    // ============================================================
    function test_Constructor() public {
        assertEq(badge.name(), NAME);
        assertEq(badge.symbol(), SYMBOL);
        assertEq(badge.owner(), owner);
        assertEq(badge.nextTokenId(), 0);
        assertEq(badge.nextBadgeTypeId(), 0);
    }

    // ============================================================
    // Badge Type Creation
    // ============================================================
    function test_CreateBadgeType() public {
        vm.prank(owner);
        uint256 typeId = badge.createBadgeType(unicode"Web3 通识", unicode"完成 Web3 通识课程", "ipfs://web3.json");

        assertEq(typeId, 0);
        assertEq(badge.nextBadgeTypeId(), 1);

        (string memory name, string memory desc, string memory uri) = badge.getBadgeType(typeId);
        assertEq(name, unicode"Web3 通识");
        assertEq(desc, unicode"完成 Web3 通识课程");
        assertEq(uri, "ipfs://web3.json");
    }

    function test_CreateBadgeTypes() public {
        string[] memory names = new string[](3);
        names[0] = unicode"Web3 通识";
        names[1] = unicode"Monad 基础";
        names[2] = unicode"智能合约";
        string[] memory descs = new string[](3);
        descs[0] = unicode"完成 Web3 通识";
        descs[1] = unicode"完成 Monad 基础";
        descs[2] = unicode"完成智能合约";
        string[] memory uris = new string[](3);
        uris[0] = "ipfs://web3.json";
        uris[1] = "ipfs://monad.json";
        uris[2] = "ipfs://contract.json";

        vm.prank(owner);
        uint256[] memory typeIds = badge.createBadgeTypes(names, descs, uris);

        assertEq(typeIds.length, 3);
        assertEq(typeIds[0], 0);
        assertEq(typeIds[1], 1);
        assertEq(typeIds[2], 2);
        assertEq(badge.nextBadgeTypeId(), 3);

        for (uint256 i = 0; i < 3; i++) {
            (string memory name, string memory desc, string memory uri) = badge.getBadgeType(i);
            assertEq(name, names[i]);
            assertEq(desc, descs[i]);
            assertEq(uri, uris[i]);
        }
    }

    // ============================================================
    // Badge Type Creation - Error Cases
    // ============================================================
    function test_RevertWhen_CreateBadgeType_EmptyName() public {
        vm.prank(owner);
        vm.expectRevert(MonadPixelFarmBadge.EmptyName.selector);
        badge.createBadgeType("", "some desc", "ipfs://uri.json");
    }

    function test_RevertWhen_NonOwnerCreatesBadgeType() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", attacker));
        badge.createBadgeType(unicode"Web3 通识", "desc", "ipfs://uri.json");
    }

    function test_RevertWhen_CreateBadgeTypes_ArrayMismatch() public {
        string[] memory names = new string[](2);
        names[0] = "A";
        names[1] = "B";
        string[] memory descs = new string[](1);
        descs[0] = "desc";
        string[] memory uris = new string[](2);
        uris[0] = "ipfs://a.json";
        uris[1] = "ipfs://b.json";

        vm.prank(owner);
        vm.expectRevert(MonadPixelFarmBadge.ArrayMismatch.selector);
        badge.createBadgeTypes(names, descs, uris);
    }

    function test_RevertWhen_CreateBadgeTypes_EmptyArray() public {
        string[] memory empty;
        vm.prank(owner);
        vm.expectRevert(MonadPixelFarmBadge.ZeroLengthArray.selector);
        badge.createBadgeTypes(empty, empty, empty);
    }

    // ============================================================
    // Minter Management
    // ============================================================
    function test_SetMinter() public {
        vm.prank(owner);
        badge.setMinter(minter, true);
        assertTrue(badge.minters(minter));

        vm.prank(owner);
        badge.setMinter(minter, false);
        assertFalse(badge.minters(minter));
    }

    function test_RevertWhen_NonOwnerSetsMinter() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", attacker));
        badge.setMinter(minter, true);
    }

    function test_OwnerIsMinter() public {
        // Owner is automatically a minter via the onlyMinter modifier
        vm.prank(owner);
        uint256 typeId = badge.createBadgeType("Web3", "desc", "ipfs://uri.json");
        vm.prank(owner);
        badge.mint(user1, typeId);
        assertTrue(badge.hasBadge(user1, typeId));
    }

    // ============================================================
    // Minting
    // ============================================================
    function test_Mint() public {
        _createAndMint("Web3", user1, 0);
        assertTrue(badge.hasBadge(user1, 0));
        assertEq(badge.balanceOf(user1), 1);
        assertEq(badge.ownerOf(0), user1);
        assertEq(badge.tokenBadgeType(0), 0);
    }

    function test_MintMultipleTypes() public {
        _createThreeTypes();
        _grantMinter();
        vm.startPrank(minter);
        badge.mint(user1, 0);
        badge.mint(user1, 1);
        badge.mint(user1, 2);
        vm.stopPrank();

        assertEq(badge.balanceOf(user1), 3);
        assertTrue(badge.hasBadge(user1, 0));
        assertTrue(badge.hasBadge(user1, 1));
        assertTrue(badge.hasBadge(user1, 2));
    }

    function test_MintDifferentUsers() public {
        _createThreeTypes();
        _grantMinter();
        vm.startPrank(minter);
        badge.mint(user1, 0);
        badge.mint(user2, 0);
        badge.mint(user2, 1);
        vm.stopPrank();

        assertEq(badge.balanceOf(user1), 1);
        assertEq(badge.balanceOf(user2), 2);
    }

    function test_tokenURI() public {
        _createAndMint("Web3", user1, 0);
        assertEq(badge.tokenURI(0), "ipfs://Web3.json");
    }

    // ============================================================
    // Minting - Error Cases
    // ============================================================
    function test_RevertWhen_Mint_NonExistentType() public {
        _grantMinter();
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(MonadPixelFarmBadge.BadgeTypeNotFound.selector, 99));
        badge.mint(user1, 99);
    }

    function test_RevertWhen_Mint_NotAuthorized() public {
        _createSingleType();
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(MonadPixelFarmBadge.NotAuthorizedMinter.selector, attacker));
        badge.mint(user1, 0);
    }

    function test_RevertWhen_Mint_DuplicateBadge() public {
        _createAndMint("Web3", user1, 0);
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(MonadPixelFarmBadge.AlreadyHasBadge.selector, user1, 0));
        badge.mint(user1, 0);
    }

    // ============================================================
    // Soulbound - Cannot Transfer
    // ============================================================
    function test_RevertWhen_Transfer() public {
        _createAndMint("Web3", user1, 0);
        vm.prank(user1);
        vm.expectRevert(MonadPixelFarmBadge.SoulboundToken.selector);
        badge.transferFrom(user1, user2, 0);
    }

    function test_RevertWhen_SafeTransfer() public {
        _createAndMint("Web3", user1, 0);
        vm.prank(user1);
        vm.expectRevert(MonadPixelFarmBadge.SoulboundToken.selector);
        badge.safeTransferFrom(user1, user2, 0);
    }

    function test_RevertWhen_ApproveAndTransfer() public {
        _createAndMint("Web3", user1, 0);
        vm.prank(user1);
        badge.approve(user2, 0);
        vm.prank(user2);
        vm.expectRevert(MonadPixelFarmBadge.SoulboundToken.selector);
        badge.transferFrom(user1, user2, 0);
    }

    function test_RevertWhen_ApproveAndSafeTransfer() public {
        _createAndMint("Web3", user1, 0);
        vm.prank(user1);
        badge.setApprovalForAll(user2, true);
        vm.prank(user2);
        vm.expectRevert(MonadPixelFarmBadge.SoulboundToken.selector);
        badge.safeTransferFrom(user1, user2, 0);
    }

    // ============================================================
    // Badge Type URI Update
    // ============================================================
    function test_UpdateBadgeTypeURI() public {
        _createSingleType();

        vm.prank(owner);
        badge.updateBadgeTypeURI(0, "ipfs://web3-v2.json");

        (,, string memory uri) = badge.getBadgeType(0);
        assertEq(uri, "ipfs://web3-v2.json");
    }

    function test_UpdateBadgeTypeURI_NonExistentType() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(MonadPixelFarmBadge.BadgeTypeNotFound.selector, 99));
        badge.updateBadgeTypeURI(99, "ipfs://new.json");
    }

    function test_UpdateBadgeTypeURI_OnlyAffectsFutureMints() public {
        _createSingleType();
        // Mint before URI update
        _grantMinter();
        vm.prank(minter);
        badge.mint(user1, 0);
        assertEq(badge.tokenURI(0), "ipfs://web3.json");

        // Update badge type URI
        vm.prank(owner);
        badge.updateBadgeTypeURI(0, "ipfs://web3-v2.json");

        // Existing token still has old URI
        assertEq(badge.tokenURI(0), "ipfs://web3.json");

        // New mint gets new URI
        vm.prank(minter);
        badge.mint(user2, 0);
        assertEq(badge.tokenURI(1), "ipfs://web3-v2.json");
    }

    // ============================================================
    // Token URI Update
    // ============================================================
    function test_UpdateTokenURI() public {
        _createAndMint("Web3", user1, 0);
        assertEq(badge.tokenURI(0), "ipfs://Web3.json");

        vm.prank(owner);
        badge.updateTokenURI(0, "ipfs://web3-updated.json");
        assertEq(badge.tokenURI(0), "ipfs://web3-updated.json");
    }

    function test_RevertWhen_NonOwnerUpdatesTokenURI() public {
        _createAndMint("Web3", user1, 0);
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", attacker));
        badge.updateTokenURI(0, "ipfs://malicious.json");
    }

    // ============================================================
    // Queries
    // ============================================================
    function test_tokensOfOwner() public {
        _createThreeTypes();
        _grantMinter();
        vm.startPrank(minter);
        badge.mint(user1, 0);
        badge.mint(user1, 1);
        badge.mint(user1, 2);
        vm.stopPrank();

        uint256[] memory tokens = badge.tokensOfOwner(user1);
        assertEq(tokens.length, 3);
        assertEq(tokens[0], 0);
        assertEq(tokens[1], 1);
        assertEq(tokens[2], 2);
    }

    function test_tokensOfOwner_Empty() public {
        uint256[] memory tokens = badge.tokensOfOwner(user1);
        assertEq(tokens.length, 0);
    }

    function test_hasBadge() public {
        _createSingleType();
        assertFalse(badge.hasBadge(user1, 0));

        _grantMinter();
        vm.prank(minter);
        badge.mint(user1, 0);
        assertTrue(badge.hasBadge(user1, 0));
    }

    function test_getBadgeType_NonExistent() public {
        vm.expectRevert(abi.encodeWithSelector(MonadPixelFarmBadge.BadgeTypeNotFound.selector, 0));
        badge.getBadgeType(0);
    }

    // ============================================================
    // Events
    // ============================================================
    function test_Event_BadgeTypeCreated() public {
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit MonadPixelFarmBadge.BadgeTypeCreated(0, unicode"Web3 通识", "ipfs://web3.json");
        badge.createBadgeType(unicode"Web3 通识", "desc", "ipfs://web3.json");
    }

    function test_Event_BadgeMinted() public {
        _createSingleType();
        _grantMinter();

        vm.prank(minter);
        vm.expectEmit(true, true, true, true);
        emit MonadPixelFarmBadge.BadgeMinted(0, 0, user1);
        badge.mint(user1, 0);
    }

    function test_Event_MinterUpdated() public {
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit MonadPixelFarmBadge.MinterUpdated(minter, true);
        badge.setMinter(minter, true);
    }

    // ============================================================
    // Edge Cases
    // ============================================================
    function test_MintMaxSupplyNotCapped() public {
        _createSingleType();
        _grantMinter();

        // Mint 5 badges to different users - should all succeed
        for (uint256 i = 0; i < 5; i++) {
            address user = address(uint160(0x400 + i));
            vm.prank(minter);
            badge.mint(user, 0);
            assertEq(badge.ownerOf(i), user);
        }
        assertEq(badge.nextTokenId(), 5);
    }

    function test_RevertWhen_MintToZeroAddress() public {
        _createSingleType();
        _grantMinter();
        vm.prank(minter);
        vm.expectRevert();
        badge.mint(address(0), 0);
    }

    function test_RevertWhen_GetBadgeType_NonExistent() public {
        vm.expectRevert(abi.encodeWithSelector(MonadPixelFarmBadge.BadgeTypeNotFound.selector, 999));
        badge.getBadgeType(999);
    }

    // ============================================================
    // Helpers
    // ============================================================
    function _createSingleType() internal {
        vm.prank(owner);
        badge.createBadgeType(unicode"Web3 通识", unicode"完成 Web3 通识课程", "ipfs://web3.json");
    }

    function _createThreeTypes() internal {
        string[] memory names = new string[](3);
        names[0] = "Web3";
        names[1] = "Monad";
        names[2] = "Contract";
        string[] memory descs = new string[](3);
        descs[0] = "desc1";
        descs[1] = "desc2";
        descs[2] = "desc3";
        string[] memory uris = new string[](3);
        uris[0] = "ipfs://web3.json";
        uris[1] = "ipfs://monad.json";
        uris[2] = "ipfs://contract.json";
        vm.prank(owner);
        badge.createBadgeTypes(names, descs, uris);
    }

    function _grantMinter() internal {
        vm.prank(owner);
        badge.setMinter(minter, true);
    }

    function _createAndMint(string memory name, address to, uint256 typeId) internal {
        vm.prank(owner);
        badge.createBadgeType(name, "desc", string.concat("ipfs://", name, ".json"));
        vm.prank(owner);
        badge.setMinter(minter, true);
        vm.prank(minter);
        badge.mint(to, typeId);
    }
}