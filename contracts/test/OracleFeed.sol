pragma solidity ^0.5.16;

interface Feed {
    function decimals() external view returns (uint8);
    function latestAnswer() external view returns (uint256);
}

/*
 * Mock oracle feed for local testing
 */
contract OracleFeed is Feed {
    uint8 private _decimals;

    constructor(uint8 decimals_) public {
        _decimals = decimals_;
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }
    
    /*
     * @dev for simplicity sake, generate random number with block number
     */
    function latestAnswer() external view returns (uint256) {
        uint256 answer = uint256(keccak256(abi.encode("key", blockhash(block.number))));
        return answer;
    }
}