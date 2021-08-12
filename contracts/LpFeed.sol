pragma solidity ^0.5.16;

import "./Exponential.sol";

interface IUniswapV2Pair {

    function totalSupply() external view returns (uint);

    function getReserves()
        external
        view
        returns (
            uint112 reserve0,
            uint112 reserve1,
            uint32 blockTimestampLast
        );
}

interface Feed {
    function decimals() external view returns (uint8);
    function latestAnswer() external view returns (uint);
}

contract LpFeed is Feed, Exponential {

    address public pair;
    Feed public feed0;
    Feed public feed1;
    uint8 public decimals;

    constructor (address _pair, Feed _feed0, Feed _feed1, uint8 _decimals) public {
        pair = _pair;
        feed0 = _feed0;
        feed1 = _feed1;
        decimals = _decimals;
    }

    function latestAnswer() public view returns (uint) {
        uint totalSupply = IUniswapV2Pair(pair).totalSupply();
        (uint r0, uint r1, ) = IUniswapV2Pair(pair).getReserves();
        uint sqrtR = sqrt(mul_(r0, r1));
        uint p0 = feed0.latestAnswer();
        uint p1 = feed1.latestAnswer();
        uint sqrtP = sqrt(mul_(p0, p1));
        return div_(mul_(2, mul_(sqrtR, sqrtP)), totalSupply);
    }

    function sqrt(uint x) pure internal returns (uint) {
        if (x == 0) return 0;
        uint xx = x;
        uint r = 1;

        if (xx >= 0x100000000000000000000000000000000) {
            xx >>= 128;
            r <<= 64;
        }
        if (xx >= 0x10000000000000000) {
            xx >>= 64;
            r <<= 32;
        }
        if (xx >= 0x100000000) {
            xx >>= 32;
            r <<= 16;
        }
        if (xx >= 0x10000) {
            xx >>= 16;
            r <<= 8;
        }
        if (xx >= 0x100) {
            xx >>= 8;
            r <<= 4;
        }
        if (xx >= 0x10) {
            xx >>= 4;
            r <<= 2;
        }
        if (xx >= 0x8) {
            r <<= 1;
        }

        r = (r + x / r) >> 1;
        r = (r + x / r) >> 1;
        r = (r + x / r) >> 1;
        r = (r + x / r) >> 1;
        r = (r + x / r) >> 1;
        r = (r + x / r) >> 1;
        r = (r + x / r) >> 1; // Seven iterations should be enough
        uint r1 = x / r;
        return (r < r1 ? r : r1);
    }
}