// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/labs/VulnerableBank.sol";
import "../contracts/labs/PatchedBank.sol";

/**
 * @title ReentrancyLabTest
 * @notice Monad Guardian Farm · Lab 1 回归测试
 *         EDUCATIONAL / TESTNET ONLY — 只针对教学靶场合约。
 *
 * 验证两点：
 *   1. VulnerableBank 可以被同一份攻击轨迹抽干（漏洞真的存在）；
 *   2. PatchedBank 在同样的攻击下会被阻断（修复真的有效）。
 */
contract ReentrancyLabTest is Test {
    GreenhouseVault internal vault;
    ReentrancyAttacker internal attacker;

    PatchedBank internal patchedBank;
    ReentrancyAttackerPatched internal patchedAttacker;

    address internal victim = address(0xBEEF);

    function setUp() public {
        // --- 漏洞版靶场 ---
        vault = new GreenhouseVault();
        vm.deal(victim, 100 ether);
        vm.prank(victim);
        vault.deposit{value: 6 ether}();

        attacker = new ReentrancyAttacker(address(vault));
        vm.deal(address(attacker), 5 ether);

        // --- 修复版靶场 ---
        patchedBank = new PatchedBank();
        vm.prank(victim);
        patchedBank.deposit{value: 6 ether}();

        patchedAttacker = new ReentrancyAttackerPatched(address(patchedBank));
        vm.deal(address(patchedAttacker), 5 ether);
    }

    /// @dev 漏洞版：攻击成功，Vault 被抽干，攻击者拿回多于自己存入的金额。
    function test_VulnerableBank_ExploitSucceeds() public {
        assertEq(vault.vaultBalance(), 6 ether, "vault should start with victim funds");

        attacker.attack{value: 1 ether}();

        assertEq(vault.vaultBalance(), 0, "vault drained to zero");
        assertGt(attacker.stolen(), 1 ether, "attacker stole more than deposited");
        assertEq(attacker.attackCount(), 6, "reentrant calls recorded");
        assertEq(vault.balances(address(attacker)), 0, "balance is zeroed only after the loop");
    }

    /// @dev 修复版：同一份攻击轨迹被阻断，资金不变量保持。
    function test_PatchedBank_ExploitBlocked() public {
        assertEq(patchedBank.vaultBalance(), 6 ether);

        vm.expectRevert(bytes("transfer failed"));
        patchedAttacker.attack{value: 1 ether}();

        assertEq(patchedBank.vaultBalance(), 6 ether, "vault balance protected");
        assertEq(patchedAttacker.attackCount(), 0, "no successful reentrant withdrawal");
    }

    /// @dev 修复版：正常用户仍然可以正常取款（回归不破坏正常流程）。
    function test_PatchedBank_NormalWithdrawStillWorks() public {
        vm.prank(victim);
        patchedBank.withdraw();

        assertEq(patchedBank.vaultBalance(), 0);
        assertEq(victim.balance, 100 ether);
    }

    /// @dev 漏洞版：单次正常取款也可以成功（说明问题只在“重入”而不在“取款”）。
    function test_VulnerableBank_SingleWithdrawWorks() public {
        vm.prank(victim);
        vault.withdraw();

        assertEq(vault.balances(victim), 0);
        assertEq(vault.vaultBalance(), 0);
    }
}
