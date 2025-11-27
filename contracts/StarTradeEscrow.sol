// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title StarTradeEscrow
 * @notice Escrow contract for USDC deposits/withdrawals on Base
 * @dev Handles user deposits, withdrawals, and bet settlement for StarTrade
 */
contract StarTradeEscrow is ReentrancyGuard, Pausable, AccessControl {
    using SafeERC20 for IERC20;

    // ============ Roles ============
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant RESOLVER_ROLE = keccak256("RESOLVER_ROLE");

    // ============ State Variables ============
    
    // USDC contract address
    // Base Mainnet: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
    // Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
    IERC20 public immutable usdc;

    // User balances (in USDC cents, 6 decimals)
    mapping(address => uint256) public balances;
    
    // Escrowed amounts (locked in active bets)
    mapping(address => uint256) public escrowed;

    // Platform fee percentage (basis points, 400 = 4%)
    uint256 public platformFeeBps = 400;
    
    // Accumulated platform fees
    uint256 public platformFees;

    // Deposit/withdrawal limits (in USDC with 6 decimals)
    uint256 public minDeposit = 1_000_000;      // $1 minimum
    uint256 public maxDeposit = 10_000_000_000; // $10,000 maximum
    uint256 public minWithdrawal = 1_000_000;   // $1 minimum
    
    // Daily limits per user (in USDC with 6 decimals)
    uint256 public defaultDailyDepositLimit = 100_000_000; // $100
    uint256 public verifiedDailyDepositLimit = 10_000_000_000; // $10,000
    
    // KYC verified users (can have higher limits)
    mapping(address => bool) public kycVerified;
    
    // Daily tracking
    mapping(address => uint256) public dailyDeposited;
    mapping(address => uint256) public lastDepositDay;

    // ============ Events ============
    
    event Deposited(address indexed user, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed user, uint256 amount, uint256 newBalance);
    event BetPlaced(address indexed user, bytes32 indexed marketId, uint256 amount, bool isYes);
    event BetSettled(address indexed user, bytes32 indexed marketId, uint256 payout, bool won);
    event BetCancelled(address indexed user, bytes32 indexed marketId, uint256 amount);
    event PlatformFeesWithdrawn(address indexed to, uint256 amount);
    event KYCStatusUpdated(address indexed user, bool verified);
    event LimitsUpdated(uint256 minDeposit, uint256 maxDeposit, uint256 minWithdrawal);

    // ============ Errors ============
    
    error InsufficientBalance();
    error InsufficientEscrow();
    error BelowMinimumDeposit();
    error AboveMaximumDeposit();
    error BelowMinimumWithdrawal();
    error DailyLimitExceeded();
    error InvalidAmount();
    error TransferFailed();

    // ============ Constructor ============
    
    constructor(address _usdc) {
        usdc = IERC20(_usdc);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(RESOLVER_ROLE, msg.sender);
    }

    // ============ User Functions ============

    /**
     * @notice Deposit USDC into escrow
     * @param amount Amount to deposit (in USDC, 6 decimals)
     */
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        if (amount < minDeposit) revert BelowMinimumDeposit();
        if (amount > maxDeposit) revert AboveMaximumDeposit();
        
        // Check daily limits
        uint256 today = block.timestamp / 1 days;
        if (lastDepositDay[msg.sender] != today) {
            dailyDeposited[msg.sender] = 0;
            lastDepositDay[msg.sender] = today;
        }
        
        uint256 dailyLimit = kycVerified[msg.sender] 
            ? verifiedDailyDepositLimit 
            : defaultDailyDepositLimit;
            
        if (dailyDeposited[msg.sender] + amount > dailyLimit) {
            revert DailyLimitExceeded();
        }
        
        // Transfer USDC from user to contract
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        
        // Update balances
        balances[msg.sender] += amount;
        dailyDeposited[msg.sender] += amount;
        
        emit Deposited(msg.sender, amount, balances[msg.sender]);
    }

    /**
     * @notice Withdraw USDC from escrow
     * @param amount Amount to withdraw (in USDC, 6 decimals)
     */
    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        if (amount < minWithdrawal) revert BelowMinimumWithdrawal();
        if (balances[msg.sender] < amount) revert InsufficientBalance();
        
        // Update balance
        balances[msg.sender] -= amount;
        
        // Transfer USDC to user
        usdc.safeTransfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, amount, balances[msg.sender]);
    }

    /**
     * @notice Get user's available balance (total - escrowed)
     */
    function availableBalance(address user) external view returns (uint256) {
        return balances[user] - escrowed[user];
    }

    /**
     * @notice Get user's total balance
     */
    function balanceOf(address user) external view returns (uint256) {
        return balances[user];
    }

    /**
     * @notice Get user's escrowed balance
     */
    function escrowedBalance(address user) external view returns (uint256) {
        return escrowed[user];
    }

    // ============ Operator Functions (Backend) ============

    /**
     * @notice Lock funds for a bet (called by backend after off-chain bet placement)
     * @param user User address
     * @param marketId Market identifier
     * @param amount Amount to escrow
     * @param isYes Whether betting YES or NO
     */
    function lockBet(
        address user,
        bytes32 marketId,
        uint256 amount,
        bool isYes
    ) external onlyRole(OPERATOR_ROLE) {
        if (amount == 0) revert InvalidAmount();
        if (balances[user] - escrowed[user] < amount) revert InsufficientBalance();
        
        escrowed[user] += amount;
        
        emit BetPlaced(user, marketId, amount, isYes);
    }

    /**
     * @notice Settle a bet (called when market resolves)
     * @param user User address
     * @param marketId Market identifier
     * @param betAmount Original bet amount
     * @param payout Amount to pay (0 if lost)
     * @param won Whether user won
     */
    function settleBet(
        address user,
        bytes32 marketId,
        uint256 betAmount,
        uint256 payout,
        bool won
    ) external onlyRole(RESOLVER_ROLE) {
        if (escrowed[user] < betAmount) revert InsufficientEscrow();
        
        // Release escrow
        escrowed[user] -= betAmount;
        
        if (won && payout > 0) {
            // Winner gets payout (platform fee already deducted in payout calculation)
            balances[user] = balances[user] - betAmount + payout;
        } else {
            // Loser loses bet amount
            balances[user] -= betAmount;
        }
        
        emit BetSettled(user, marketId, payout, won);
    }

    /**
     * @notice Cancel a bet and return funds
     * @param user User address
     * @param marketId Market identifier  
     * @param amount Amount to return
     */
    function cancelBet(
        address user,
        bytes32 marketId,
        uint256 amount
    ) external onlyRole(OPERATOR_ROLE) {
        if (escrowed[user] < amount) revert InsufficientEscrow();
        
        escrowed[user] -= amount;
        
        emit BetCancelled(user, marketId, amount);
    }

    /**
     * @notice Batch settle multiple bets
     * @param users Array of user addresses
     * @param marketIds Array of market IDs
     * @param betAmounts Array of bet amounts
     * @param payouts Array of payouts
     * @param wonFlags Array of win flags
     */
    function batchSettleBets(
        address[] calldata users,
        bytes32[] calldata marketIds,
        uint256[] calldata betAmounts,
        uint256[] calldata payouts,
        bool[] calldata wonFlags
    ) external onlyRole(RESOLVER_ROLE) {
        require(
            users.length == marketIds.length &&
            users.length == betAmounts.length &&
            users.length == payouts.length &&
            users.length == wonFlags.length,
            "Array length mismatch"
        );

        for (uint256 i = 0; i < users.length; i++) {
            if (escrowed[users[i]] >= betAmounts[i]) {
                escrowed[users[i]] -= betAmounts[i];
                
                if (wonFlags[i] && payouts[i] > 0) {
                    balances[users[i]] = balances[users[i]] - betAmounts[i] + payouts[i];
                } else {
                    balances[users[i]] -= betAmounts[i];
                }
                
                emit BetSettled(users[i], marketIds[i], payouts[i], wonFlags[i]);
            }
        }
    }

    /**
     * @notice Collect platform fees from bet settlements
     * @param amount Amount to add to platform fees
     */
    function collectPlatformFee(uint256 amount) external onlyRole(OPERATOR_ROLE) {
        platformFees += amount;
    }

    // ============ Admin Functions ============

    /**
     * @notice Set KYC status for a user
     */
    function setKYCStatus(address user, bool verified) external onlyRole(OPERATOR_ROLE) {
        kycVerified[user] = verified;
        emit KYCStatusUpdated(user, verified);
    }

    /**
     * @notice Batch set KYC status
     */
    function batchSetKYCStatus(
        address[] calldata users, 
        bool[] calldata verified
    ) external onlyRole(OPERATOR_ROLE) {
        require(users.length == verified.length, "Array length mismatch");
        for (uint256 i = 0; i < users.length; i++) {
            kycVerified[users[i]] = verified[i];
            emit KYCStatusUpdated(users[i], verified[i]);
        }
    }

    /**
     * @notice Update deposit/withdrawal limits
     */
    function setLimits(
        uint256 _minDeposit,
        uint256 _maxDeposit,
        uint256 _minWithdrawal
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minDeposit = _minDeposit;
        maxDeposit = _maxDeposit;
        minWithdrawal = _minWithdrawal;
        emit LimitsUpdated(_minDeposit, _maxDeposit, _minWithdrawal);
    }

    /**
     * @notice Update daily deposit limits
     */
    function setDailyLimits(
        uint256 _defaultLimit,
        uint256 _verifiedLimit
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        defaultDailyDepositLimit = _defaultLimit;
        verifiedDailyDepositLimit = _verifiedLimit;
    }

    /**
     * @notice Update platform fee
     */
    function setPlatformFeeBps(uint256 _feeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_feeBps <= 1000, "Fee too high"); // Max 10%
        platformFeeBps = _feeBps;
    }

    /**
     * @notice Withdraw accumulated platform fees
     */
    function withdrawPlatformFees(address to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 amount = platformFees;
        platformFees = 0;
        usdc.safeTransfer(to, amount);
        emit PlatformFeesWithdrawn(to, amount);
    }

    /**
     * @notice Pause contract (emergency)
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Emergency withdraw (admin only, for stuck funds)
     */
    function emergencyWithdraw(
        address token,
        address to,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(token).safeTransfer(to, amount);
    }
}
