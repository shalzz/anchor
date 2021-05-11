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
     * @dev for simplicity sake
     */
    function latestAnswer() external view returns (uint256) {
        return 900 * 1e18;
    }
}