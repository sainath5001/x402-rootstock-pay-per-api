// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PayPerAPI
 * @notice A minimal smart contract for pay-per-request API access using RBTC on Rootstock
 * @dev This contract is designed to support x402 (HTTP 402 Payment Required) payment flows.
 *      The backend API server will verify payments on-chain before serving API responses.
 *
 * Flow:
 * 1. Client makes API request
 * 2. API server responds with HTTP 402 and payment instructions
 * 3. Client/wallet sends RBTC payment to this contract
 * 4. API server verifies payment using hasPaid() or getPaymentBalance()
 * 5. API server serves the requested data
 */
contract PayPerAPI {
    /// @notice The price per API request in wei (smallest unit of RBTC)
    uint256 public immutable pricePerRequest;

    /// @notice Mapping to track total payments made by each address
    /// @dev This allows clients to accumulate credit for multiple API calls
    mapping(address => uint256) public paymentBalances;

    /// @notice Event emitted when a payment is received
    /// @param payer The address that made the payment
    /// @param amount The amount of RBTC paid
    /// @param newBalance The payer's new total payment balance
    event PaymentReceived(address indexed payer, uint256 amount, uint256 newBalance);

    /// @notice Event emitted when the contract owner withdraws funds
    /// @param to The address that received the withdrawal
    /// @param amount The amount of RBTC withdrawn
    event FundsWithdrawn(address indexed to, uint256 amount);

    /// @notice The owner of the contract (can withdraw funds)
    address public immutable owner;

    /**
     * @notice Constructor sets the price per API request and contract owner
     * @param _pricePerRequest The price in wei (e.g., 0.001 RBTC = 1000000000000000 wei)
     */
    constructor(uint256 _pricePerRequest) {
        require(_pricePerRequest > 0, "Price must be greater than zero");
        pricePerRequest = _pricePerRequest;
        owner = msg.sender;
    }

    /**
     * @notice Accept RBTC payments and track them per address
     * @dev This is the main payable function that clients call to pay for API access.
     *      The payment is added to the sender's balance, allowing them to make multiple
     *      API calls without paying each time (until balance is depleted).
     */
    function pay() external payable {
        require(msg.value > 0, "Payment amount must be greater than zero");
        
        paymentBalances[msg.sender] += msg.value;
        
        emit PaymentReceived(msg.sender, msg.value, paymentBalances[msg.sender]);
    }

    /**
     * @notice Check if an address has paid at least the required amount for one API request
     * @param payer The address to check
     * @return true if the payer has sufficient balance for at least one API request
     */
    function hasPaid(address payer) external view returns (bool) {
        return paymentBalances[payer] >= pricePerRequest;
    }

    /**
     * @notice Get the payment balance for a specific address
     * @param payer The address to query
     * @return The total amount of RBTC paid by this address
     */
    function getPaymentBalance(address payer) external view returns (uint256) {
        return paymentBalances[payer];
    }

    /**
     * @notice Calculate how many API requests an address can make with their current balance
     * @param payer The address to query
     * @return The number of API requests that can be made (integer division)
     */
    function getAvailableRequests(address payer) external view returns (uint256) {
        return paymentBalances[payer] / pricePerRequest;
    }

    /**
     * @notice Deduct payment for an API request (called by API server after verification)
     * @dev This function should be called by the API server's backend after verifying
     *      that a payment was made. In a production system, this would typically be
     *      called via a backend service that has permission to deduct payments.
     * @param payer The address whose balance should be deducted
     * @param amount The amount to deduct (typically pricePerRequest)
     */
    function deductPayment(address payer, uint256 amount) external {
        require(msg.sender == owner, "Only owner can deduct payments");
        require(paymentBalances[payer] >= amount, "Insufficient balance");
        
        paymentBalances[payer] -= amount;
    }

    /**
     * @notice Withdraw accumulated funds to the contract owner
     * @dev Only the owner can withdraw funds from the contract
     */
    function withdraw() external {
        require(msg.sender == owner, "Only owner can withdraw");
        
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "Withdrawal failed");
        
        emit FundsWithdrawn(owner, balance);
    }

    /**
     * @notice Get the contract's current RBTC balance
     * @return The total amount of RBTC held by the contract
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}

