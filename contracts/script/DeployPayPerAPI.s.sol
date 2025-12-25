// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PayPerAPI} from "../src/PayPerAPI.sol";

/**
 * @title DeployPayPerAPI
 * @notice Deployment script for PayPerAPI contract on Rootstock testnet
 * 
 * Usage:
 *   forge script script/DeployPayPerAPI.s.sol:DeployPayPerAPI \
 *     --rpc-url $ROOTSTOCK_TESTNET_RPC_URL \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast \
 *     --verify
 * 
 * Environment variables:
 *   ROOTSTOCK_TESTNET_RPC_URL: RPC endpoint for Rootstock testnet
 *   PRIVATE_KEY: Private key of the deployer account
 *   ETHERSCAN_API_KEY: (Optional) For contract verification
 */
contract DeployPayPerAPI is Script {
    // Default price: 0.001 RBTC per API request
    // You can modify this value or pass it as an environment variable
    uint256 public constant DEFAULT_PRICE_PER_REQUEST = 0.001 ether;

    function run() external returns (PayPerAPI) {
        // Get price from environment or use default
        uint256 pricePerRequest = vm.envOr("PRICE_PER_REQUEST", DEFAULT_PRICE_PER_REQUEST);
        
        // Start broadcasting transactions
        // Private key is passed via --private-key flag, or use vm.startBroadcast() without args
        // If PRIVATE_KEY env var exists and is hex, use it; otherwise rely on --private-key flag
        vm.startBroadcast();
        
        // Log deployment information
        console.log("Deploying PayPerAPI contract...");
        console.log("Price per request:", pricePerRequest);
        
        // Deploy the contract
        PayPerAPI payPerAPI = new PayPerAPI(pricePerRequest);
        
        // Log deployment results
        console.log("PayPerAPI deployed at:", address(payPerAPI));
        console.log("Contract owner:", payPerAPI.owner());
        console.log("Price per request:", payPerAPI.pricePerRequest());
        
        vm.stopBroadcast();
        
        return payPerAPI;
    }
}

