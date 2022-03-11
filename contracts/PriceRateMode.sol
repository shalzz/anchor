pragma solidity ^0.5.16;

import "./SafeMath.sol";

interface IFeed {
    function decimals() external view returns (uint8);
    function latestAnswer() external view returns (uint);
}

/**
  * @title DOLA's price base InterestRateModel.
  * @author @shalzz
  */
contract PriceRateModel {
    using SafeMath for uint;

    event NewInterestParams(uint baseRatePerBlock);

    /**
     * @notice The address of the owner, i.e. the Timelock contract, which can update parameters directly
     */
    address public owner;

    /**
     * @notice The approximate number of blocks per year that is assumed by the interest rate model
     */
    uint public constant blocksPerYear = 2102400;

    /**
     * @notice The base interest rate to target
     */
    uint public baseRatePerBlock;

    /**
     * @notice The current interest rate
     */
    uint public currentRatePerBlock;

    uint public negativeDepegThreshold;
    uint public positiveDepegThreshold;
    uint public maxRate;
    uint public minRate;
    uint public rateStep;

    IFeed priceFeed;

    /**
     * @notice Construct an interest rate model
     * @param baseRatePerYear The approximate target base APR, as a mantissa (scaled by 1e18)
     * @param owner_ The address of the owner, i.e. the Timelock contract (which has the ability to update parameters directly)
     */
    constructor(
        uint baseRatePerYear,
        uint negativeDepegThreshold_,
        uint positiveDepegThreshold_,
        uint maxRate_,
        uint minRate_,
        uint rateStep_,
        IFeed priceFeed_,
        address owner_
    ) internal {
        baseRatePerBlock = baseRatePerYear.div(blocksPerYear);
        currentRatePerBlock = baseRatePerBlock;

        negativeDepegThreshold = negativeDepegThreshold_;
        positiveDepegThreshold = positiveDepegThreshold_;
        maxRate = maxRate_;
        minRate = minRate_;
        rateStep = rateStep_;
        priceFeed = priceFeed_;
        owner = owner_;
    }

    /**
     * @notice Update the base rate (only callable by owner, i.e. Timelock)
     * @param baseRatePerYear The approximate target base APR, as a mantissa (scaled by 1e18)
     */
    function setBaseRate(uint baseRatePerYear) external {
        require(msg.sender == owner, "only the owner may call this function.");

        baseRatePerBlock = baseRatePerYear.div(blocksPerYear);
    }

    function updateRate() external {
        uint price = priceFeed.latestAnswer();

        if (price < negativeDepegThreshold ) {
            currentRatePerBlock = currentRatePerBlock.add(rateStep);
            if (currentRatePerBlock > maxRate) {
                currentRatePerBlock = maxRate;
            }
        } else if (price > positiveDepegThreshold) {
            currentRatePerBlock = currentRatePerBlock.sub(rateStep);
            if (currentRatePerBlock < minRate) {
                currentRatePerBlock = minRate;
            }
        } else if (currentRatePerBlock != baseRatePerBlock) {
            if (currentRatePerBlock < baseRatePerBlock) {
                currentRatePerBlock = currentRatePerBlock.add(rateStep);
                if (currentRatePerBlock > baseRatePerBlock) {
                    currentRatePerBlock = baseRatePerBlock;
                }
            } else if (currentRatePerBlock > baseRatePerBlock) {
                currentRatePerBlock = currentRatePerBlock.sub(rateStep);
                if (currentRatePerBlock < baseRatePerBlock) {
                    currentRatePerBlock = baseRatePerBlock;
                }
            }
        }

        emit NewInterestParams(currentRatePerBlock);
    }

    /**
     * @notice Calculates the utilization rate of the market: `borrows / (cash + borrows - reserves)`
     * @param cash The amount of cash in the market
     * @param borrows The amount of borrows in the market
     * @param reserves The amount of reserves in the market (currently unused)
     * @return The utilization rate as a mantissa between [0, 1e18]
     */
    function utilizationRate(uint cash, uint borrows, uint reserves) public pure returns (uint) {
        // Utilization rate is 0 when there are no borrows
        if (borrows == 0) {
            return 0;
        }

        return borrows.mul(1e18).div(cash.add(borrows).sub(reserves));
    }

    /**
     * @notice Calculates the current borrow rate per block, with the error code expected by the market
     * @param cash The amount of cash in the market
     * @param borrows The amount of borrows in the market
     * @param reserves The amount of reserves in the market
     * @return The borrow rate percentage per block as a mantissa (scaled by 1e18)
     */
    function getBorrowRateInternal(uint cash, uint borrows, uint reserves) internal view returns (uint) {
        return currentRatePerBlock;
    }

    /**
     * @notice Calculates the current supply rate per block
     * @param cash The amount of cash in the market
     * @param borrows The amount of borrows in the market
     * @param reserves The amount of reserves in the market
     * @param reserveFactorMantissa The current reserve factor for the market
     * @return The supply rate percentage per block as a mantissa (scaled by 1e18)
     */
    function getSupplyRate(uint cash, uint borrows, uint reserves, uint reserveFactorMantissa) public view returns (uint) {
        uint oneMinusReserveFactor = uint(1e18).sub(reserveFactorMantissa);
        uint borrowRate = getBorrowRateInternal(cash, borrows, reserves);
        uint rateToPool = borrowRate.mul(oneMinusReserveFactor).div(1e18);
        return utilizationRate(cash, borrows, reserves).mul(rateToPool).div(1e18);
    }
}
