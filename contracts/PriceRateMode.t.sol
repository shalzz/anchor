// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.5.16;

import "./PriceRateMode.sol";
import "./DolaFeed.sol";
import "./CErc20.sol";

import "ds-test/test.sol";
import "./test/Vm.sol";

contract PriceRateModelTest is DSTest {
    Vm vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    address public admin = address(1);
    address public user = address(2);

    IFeed public feed;
    CTokenInterface public ctoken;

    PriceRateModel priceModel;

    function setUp() public {
        // Solidity reverts when mocking an address with no code
        // due to `extcodesize` checks.
        // So need to actually instantiate dependencies.
        feed = new DolaFeed();
        ctoken = new CErc20();

        priceModel = new PriceRateModel(
                10000000000000000,      // baseRatePerYear = 1% APY
                950000000000000000,     // negativeDepegThreshold
                1050000000000000000,    // positiveDepegThreshold
                47564687975,            // maxRate = 10% APY
                475646879,              // minRate = 0.1% APY
                475646879,              // rateStep = 0.1% APY
                86400,                  // updateRateInterval = 1 day
                feed,
                ctoken,
                admin
        );
        // Move time ahead to enable calling updateRate
        // for the first time after deployment
        vm.warp(block.timestamp + priceModel.updateRateInterval() + 1);
    }

    function testGetBorrowRate() public {
        uint rate = priceModel.getBorrowRate(0, 0, 0);
        assertEq(rate, 4756468797);
    }

    function testUpdateRateWithNegThreshold() public {
        uint rate = priceModel.getBorrowRate(0, 0, 0);

        vm.mockCall(
            address(feed),
            abi.encodeWithSelector(feed.latestAnswer.selector),
            abi.encode(priceModel.negativeDepegThreshold() - 1)
        );
        priceModel.updateRate();
        uint newRate = priceModel.getBorrowRate(0, 0, 0);

        // Should only increase/decrease by rateStep
        assertEq(newRate, rate + priceModel.rateStep());
    }

    function testUpdateRateWithPosThreshold() public {
        uint rate = priceModel.getBorrowRate(0, 0, 0);

        vm.mockCall(
            address(feed),
            abi.encodeWithSelector(feed.latestAnswer.selector),
            abi.encode(priceModel.positiveDepegThreshold() + 1)
        );
        priceModel.updateRate();
        uint newRate = priceModel.getBorrowRate(0, 0, 0);

        // Should only increase/decrease by rateStep
        assertEq(newRate, rate - priceModel.rateStep());
    }

    function testUpdateRateWithMaxRate() public {
        uint maxRate = priceModel.maxRate();
        vm.prank(admin);
        priceModel.setCurrentRate(maxRate - 1);

        vm.mockCall(
            address(feed),
            abi.encodeWithSelector(feed.latestAnswer.selector),
            abi.encode(priceModel.negativeDepegThreshold() - 1)
        );
        priceModel.updateRate();
        uint newRate = priceModel.getBorrowRate(0, 0, 0);

        // Shouldn't go beyond maxRate
        assertEq(newRate, maxRate);
    }

    function testUpdateRateWithMinRate() public {
        uint minRate = priceModel.minRate();
        vm.prank(admin);
        priceModel.setCurrentRate(minRate + 1);

        vm.mockCall(
            address(feed),
            abi.encodeWithSelector(feed.latestAnswer.selector),
            abi.encode(priceModel.positiveDepegThreshold() + 1)
        );
        priceModel.updateRate();
        uint newRate = priceModel.getBorrowRate(0, 0, 0);

        // Shouldn't go below minRate
        assertEq(newRate, minRate);
    }

    function testUpdateRateBtwThreshold() public {
        uint baseRate = priceModel.baseRatePerBlock();

        // Increase current rate
        vm.prank(admin);
        priceModel.setCurrentRate(baseRate + 1);
        priceModel.updateRate();
        uint newRate = priceModel.getBorrowRate(0, 0, 0);

        // Decrease current rate
        vm.prank(admin);
        priceModel.setCurrentRate(baseRate - 1);
        vm.warp(block.timestamp + priceModel.updateRateInterval() + 1);
        priceModel.updateRate();
        uint newRate2 = priceModel.getBorrowRate(0, 0, 0);

        assertEq(newRate, baseRate);
        assertEq(newRate2, baseRate);
    }

    function testUpdateRateWithInterval() public {
        uint rate = priceModel.getBorrowRate(0, 0, 0);

        vm.mockCall(
            address(feed),
            abi.encodeWithSelector(feed.latestAnswer.selector),
            abi.encode(priceModel.negativeDepegThreshold() - 1)
        );
        priceModel.updateRate();
        uint newRate = priceModel.getBorrowRate(0, 0, 0);

        priceModel.updateRate();
        uint newRate2 = priceModel.getBorrowRate(0, 0, 0);

        // Shouldn't update the rate again until after updateRateInterval.
        assertTrue(rate != newRate);
        assertEq(newRate, newRate2);
    }

    function testUpdateRateWithIntervalNeverReverts() public {
        priceModel.updateRate();
        priceModel.updateRate();
        priceModel.updateRate();
    }

    function testUpdateRateCallsCToken() public {
        vm.expectCall(
            address(ctoken),
            abi.encodeWithSelector(ctoken.accrueInterest.selector)
        );
        vm.mockCall(
            address(feed),
            abi.encodeWithSelector(feed.latestAnswer.selector),
            abi.encode(priceModel.positiveDepegThreshold() + 1)
        );
        priceModel.updateRate();
    }

    function testOwnerOnlyFunctions() public {
        vm.startPrank(admin);
        priceModel.setBaseRate(1);
        priceModel.setCurrentRate(1);
        priceModel.setNegThreshold(1);
        priceModel.setPosThreshold(1);
        priceModel.setMaxRate(1);
        priceModel.setMinRate(1);
        priceModel.setRateStep(1);
        priceModel.setUpdateRateInterval(1);
        priceModel.setPriceFeed(IFeed(address(99)));
        priceModel.setCToken(CTokenInterface(address(99)));
        vm.stopPrank();

        vm.expectRevert("only the owner may call this function.");
        priceModel.setBaseRate(1);
        vm.expectRevert("only the owner may call this function.");
        priceModel.setCurrentRate(1);
        vm.expectRevert("only the owner may call this function.");
        priceModel.setNegThreshold(1);
        vm.expectRevert("only the owner may call this function.");
        priceModel.setPosThreshold(1);
        vm.expectRevert("only the owner may call this function.");
        priceModel.setMaxRate(1);
        vm.expectRevert("only the owner may call this function.");
        priceModel.setMinRate(1);
        vm.expectRevert("only the owner may call this function.");
        priceModel.setRateStep(1);
        vm.expectRevert("only the owner may call this function.");
        priceModel.setUpdateRateInterval(1);
        vm.expectRevert("only the owner may call this function.");
        priceModel.setPriceFeed(IFeed(address(99)));
        vm.expectRevert("only the owner may call this function.");
        priceModel.setCToken(CTokenInterface(address(99)));
    }
}
