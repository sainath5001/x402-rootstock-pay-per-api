// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {PayPerAPI} from "../src/PayPerAPI.sol";

/**
 * @title PayPerAPITest
 * @notice Foundry tests for the PayPerAPI contract
 */
contract PayPerAPITest is Test {
    PayPerAPI public payPerAPI;
    
    // Test users
    address public owner;
    address public payer1;
    address public payer2;
    
    // Test price: 0.001 RBTC = 1000000000000000 wei
    uint256 public constant PRICE_PER_REQUEST = 0.001 ether;
    
    event PaymentReceived(address indexed payer, uint256 amount, uint256 newBalance);
    event FundsWithdrawn(address indexed to, uint256 amount);

    function setUp() public {
        owner = address(this);
        payer1 = address(0x1);
        payer2 = address(0x2);
        
        // Deploy the contract
        payPerAPI = new PayPerAPI(PRICE_PER_REQUEST);
    }

    /**
     * @notice Test that the contract is initialized correctly
     */
    function test_Initialization() public view {
        assertEq(payPerAPI.pricePerRequest(), PRICE_PER_REQUEST);
        assertEq(payPerAPI.owner(), owner);
        assertEq(payPerAPI.getContractBalance(), 0);
    }

    /**
     * @notice Test that constructor reverts with zero price
     */
    function test_RevertIf_ZeroPrice() public {
        vm.expectRevert("Price must be greater than zero");
        new PayPerAPI(0);
    }

    /**
     * @notice Test basic payment functionality
     */
    function test_Pay() public {
        uint256 paymentAmount = 0.002 ether; // Pay for 2 requests
        
        vm.deal(payer1, paymentAmount);
        vm.prank(payer1);
        
        vm.expectEmit(true, false, false, true);
        emit PaymentReceived(payer1, paymentAmount, paymentAmount);
        
        payPerAPI.pay{value: paymentAmount}();
        
        // Check balance was recorded
        assertEq(payPerAPI.getPaymentBalance(payer1), paymentAmount);
        assertEq(payPerAPI.getContractBalance(), paymentAmount);
    }

    /**
     * @notice Test that payment reverts with zero amount
     */
    function test_RevertIf_ZeroPayment() public {
        vm.prank(payer1);
        vm.expectRevert("Payment amount must be greater than zero");
        payPerAPI.pay{value: 0}();
    }

    /**
     * @notice Test hasPaid function
     */
    function test_HasPaid() public {
        // Initially, payer has not paid
        assertFalse(payPerAPI.hasPaid(payer1));
        
        // Pay exactly the required amount
        vm.deal(payer1, PRICE_PER_REQUEST);
        vm.prank(payer1);
        payPerAPI.pay{value: PRICE_PER_REQUEST}();
        
        // Now should have paid
        assertTrue(payPerAPI.hasPaid(payer1));
        
        // Pay less than required
        address payer3 = address(0x3);
        vm.deal(payer3, PRICE_PER_REQUEST / 2);
        vm.prank(payer3);
        payPerAPI.pay{value: PRICE_PER_REQUEST / 2}();
        
        // Should not have paid enough
        assertFalse(payPerAPI.hasPaid(payer3));
    }

    /**
     * @notice Test getAvailableRequests function
     */
    function test_GetAvailableRequests() public {
        // Pay for 3 requests
        uint256 paymentAmount = PRICE_PER_REQUEST * 3;
        vm.deal(payer1, paymentAmount);
        vm.prank(payer1);
        payPerAPI.pay{value: paymentAmount}();
        
        assertEq(payPerAPI.getAvailableRequests(payer1), 3);
        
        // Pay for 2.5 requests (should round down to 2)
        address payer3 = address(0x3);
        uint256 partialPayment = PRICE_PER_REQUEST * 2 + PRICE_PER_REQUEST / 2;
        vm.deal(payer3, partialPayment);
        vm.prank(payer3);
        payPerAPI.pay{value: partialPayment}();
        
        assertEq(payPerAPI.getAvailableRequests(payer3), 2);
    }

    /**
     * @notice Test multiple payments accumulate balance
     */
    function test_MultiplePaymentsAccumulate() public {
        vm.deal(payer1, PRICE_PER_REQUEST * 2);
        
        // First payment
        vm.prank(payer1);
        payPerAPI.pay{value: PRICE_PER_REQUEST}();
        assertEq(payPerAPI.getPaymentBalance(payer1), PRICE_PER_REQUEST);
        
        // Second payment
        vm.prank(payer1);
        payPerAPI.pay{value: PRICE_PER_REQUEST}();
        assertEq(payPerAPI.getPaymentBalance(payer1), PRICE_PER_REQUEST * 2);
        
        // Should have 2 available requests
        assertEq(payPerAPI.getAvailableRequests(payer1), 2);
    }

    /**
     * @notice Test deductPayment function
     */
    function test_DeductPayment() public {
        // Pay for 2 requests
        uint256 paymentAmount = PRICE_PER_REQUEST * 2;
        vm.deal(payer1, paymentAmount);
        vm.prank(payer1);
        payPerAPI.pay{value: paymentAmount}();
        
        // Deduct one payment (as owner)
        payPerAPI.deductPayment(payer1, PRICE_PER_REQUEST);
        
        // Balance should be reduced
        assertEq(payPerAPI.getPaymentBalance(payer1), PRICE_PER_REQUEST);
        assertEq(payPerAPI.getAvailableRequests(payer1), 1);
    }

    /**
     * @notice Test that non-owner cannot deduct payments
     */
    function test_RevertIf_NonOwnerDeducts() public {
        vm.deal(payer1, PRICE_PER_REQUEST);
        vm.prank(payer1);
        payPerAPI.pay{value: PRICE_PER_REQUEST}();
        
        // Non-owner tries to deduct
        vm.prank(payer1);
        vm.expectRevert("Only owner can deduct payments");
        payPerAPI.deductPayment(payer1, PRICE_PER_REQUEST);
    }

    /**
     * @notice Test that deductPayment reverts if insufficient balance
     */
    function test_RevertIf_InsufficientBalanceForDeduction() public {
        vm.deal(payer1, PRICE_PER_REQUEST);
        vm.prank(payer1);
        payPerAPI.pay{value: PRICE_PER_REQUEST}();
        
        // Try to deduct more than available
        vm.expectRevert("Insufficient balance");
        payPerAPI.deductPayment(payer1, PRICE_PER_REQUEST * 2);
    }

    /**
     * @notice Test withdraw function
     */
    function test_Withdraw() public {
        // Create a separate owner address that can receive funds
        address withdrawOwner = address(0x999);
        vm.deal(withdrawOwner, 0);
        
        // Deploy a new contract with a different owner
        vm.prank(withdrawOwner);
        PayPerAPI testContract = new PayPerAPI(PRICE_PER_REQUEST);
        
        // Collect payments from multiple payers
        vm.deal(payer1, PRICE_PER_REQUEST);
        vm.deal(payer2, PRICE_PER_REQUEST * 2);
        
        vm.prank(payer1);
        testContract.pay{value: PRICE_PER_REQUEST}();
        
        vm.prank(payer2);
        testContract.pay{value: PRICE_PER_REQUEST * 2}();
        
        uint256 contractBalance = testContract.getContractBalance();
        assertEq(contractBalance, PRICE_PER_REQUEST * 3);
        
        // Withdraw as owner
        uint256 ownerBalanceBefore = withdrawOwner.balance;
        
        // Expect the event
        vm.expectEmit(true, false, false, true);
        emit FundsWithdrawn(withdrawOwner, contractBalance);
        
        vm.prank(withdrawOwner);
        testContract.withdraw();
        
        // Contract should be empty
        assertEq(testContract.getContractBalance(), 0);
        
        // Owner should have received funds
        assertEq(withdrawOwner.balance, ownerBalanceBefore + contractBalance);
    }

    /**
     * @notice Test that non-owner cannot withdraw
     */
    function test_RevertIf_NonOwnerWithdraws() public {
        vm.deal(payer1, PRICE_PER_REQUEST);
        vm.prank(payer1);
        payPerAPI.pay{value: PRICE_PER_REQUEST}();
        
        // Non-owner tries to withdraw
        vm.prank(payer1);
        vm.expectRevert("Only owner can withdraw");
        payPerAPI.withdraw();
    }

    /**
     * @notice Test that withdraw reverts if no funds
     */
    function test_RevertIf_WithdrawNoFunds() public {
        vm.expectRevert("No funds to withdraw");
        payPerAPI.withdraw();
    }

    /**
     * @notice Test end-to-end x402 flow simulation
     * This simulates the actual x402 payment flow:
     * 1. Client makes payment
     * 2. API server checks payment
     * 3. API server deducts payment after serving request
     */
    function test_X402Flow() public {
        // Step 1: Client pays for API access
        vm.deal(payer1, PRICE_PER_REQUEST * 5);
        vm.prank(payer1);
        payPerAPI.pay{value: PRICE_PER_REQUEST * 5}();
        
        // Step 2: API server checks if client has paid (simulated by contract owner)
        assertTrue(payPerAPI.hasPaid(payer1));
        assertEq(payPerAPI.getAvailableRequests(payer1), 5);
        
        // Step 3: API server serves request and deducts payment
        payPerAPI.deductPayment(payer1, PRICE_PER_REQUEST);
        assertEq(payPerAPI.getAvailableRequests(payer1), 4);
        
        // Client can make 4 more requests
        assertTrue(payPerAPI.hasPaid(payer1));
        
        // Make 4 more requests
        for (uint256 i = 0; i < 4; i++) {
            payPerAPI.deductPayment(payer1, PRICE_PER_REQUEST);
        }
        
        // Now client needs to pay again
        assertFalse(payPerAPI.hasPaid(payer1));
        assertEq(payPerAPI.getAvailableRequests(payer1), 0);
    }
}

