// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.5.16;

import "./CTokenInterfaces.sol";
import "./InterestRateModel.sol";
import "./PriceRateMode.sol";

import "ds-test/test.sol";
import "./test/Vm.sol";

contract PriceRateModelTest is DSTest {
    Vm vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    address public admin = address(1);
    address public user = address(2);
    address public feed = address(3);
    address public ctoken = address(4);

    PriceRateModel priceModel;

    function setUp() public {
        priceModel = new PriceRateModel(
                199999999999999999,
                190000000000000000,
                199900000000000000,
                199999999999999999,
                190000000000000000,
                199900000000000000,
                15000000,
                IFeed(feed),
                CTokenInterface(ctoken),
                admin
        );
    }

    function testOwnerOnlyFunctions() public {
        vm.prank(admin);
        priceModel.setBaseRate(1);
    }

    function testExample() public {
        assertTrue(true);
    }
}
