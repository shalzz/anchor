//SPDX-License-Identifier: None
pragma solidity 0.8.9;

interface ERC20 {
    function approve(address,uint) external returns (bool);
    function balanceOf(address) external view returns (uint);
    function mint(address,uint) external; // only on src chain
    function burn(uint) external; // only on src chain
    function Swapout(uint,address) external returns (bool);
    function transfer(address,uint) external returns (bool);
}

interface CErc20 {
    function mint(uint) external returns (uint);
    function redeemUnderlying(uint) external returns (uint);
    function balanceOfUnderlying(address) external returns (uint);
}

contract xChainFed {

    // Shared

    address public constant GOV = 0x926dF14a23BE491164dCF93f4c468A50ef659D5B;
    address public chair = 0x3FcB35a1CbFB6007f9BC638D388958Bc4550cB28;
    
    modifier onlyChair {
        require(msg.sender == chair || msg.sender == GOV, "ONLY CHAIN OR GOV");
        _;
    }

    function changeChair(address newChair_) public {
        require(msg.sender == chair || msg.sender == GOV, "ONLY CHAIN OR GOV");
        chair = newChair_;
    }

    function sweep(ERC20 token) public onlyChair {
        require(token != SRC_DOLA && token != DST_DOLA && token != ERC20(address(DST_MARKET)), "cannot steal DOLA");
        token.transfer(msg.sender, token.balanceOf(address(this)));
    }

    // Source side (Ethereum)

    ERC20 public constant SRC_DOLA = ERC20(0x865377367054516e17014CcdED1e7d814EDC9ce4);
    address public constant SRC_BRIDGE = 0xC564EE9f21Ed8A2d8E7e76c085740d5e4c5FaFbE;

    modifier onlySrc {
        require(block.chainid == 1, "WRONG CHAIN");
        _;
    }

    function srcMintReserves(uint amount) public onlyChair onlySrc {
        SRC_DOLA.mint(address(this), amount);
    }

    function srcBurnReserves(uint amount) public onlyChair onlySrc {
        SRC_DOLA.burn(amount);
    }

    function srcTransferReservesToDst(uint amount) public onlyChair onlySrc {
        SRC_DOLA.transfer(SRC_BRIDGE, amount);
    }

    // Destination side (Fantom)
    
    ERC20 public constant DST_DOLA = ERC20(0x3129662808bEC728a27Ab6a6b9AFd3cBacA8A43c);
    CErc20 public constant DST_MARKET = CErc20(0x5A3B9Dcdd462f264eC1bD56D618BF4552C2EaF8A);
    uint public dstSupply;

    modifier onlyDst {
        require(block.chainid != 1, "WRONG CHAIN");
        _;
    }
    
    function dstTransferReservesToSrc(uint amount) public onlyChair onlyDst {
        require(DST_DOLA.Swapout(amount, address(this)));
    }

    function dstExpansion(uint amount) public onlyChair onlyDst {
        DST_DOLA.approve(address(DST_MARKET), amount);
        require(DST_MARKET.mint(amount) == 0, 'Supplying failed');
        dstSupply = dstSupply + amount;
        emit Expansion(amount);
    }

    function dstContraction(uint amount) public onlyChair onlyDst {
        require(amount <= dstSupply, "AMOUNT TOO BIG"); // can't burn profits
        require(DST_MARKET.redeemUnderlying(amount) == 0, "Redeem failed");
        dstSupply = dstSupply - amount;
        emit Contraction(amount);
    }

    function dstSendProfitToGov() public onlyChair onlyDst {
        uint underlyingBalance = DST_MARKET.balanceOfUnderlying(address(this));
        uint profit = underlyingBalance - dstSupply;
        if(profit > 0) {
            require(DST_MARKET.redeemUnderlying(profit) == 0, "Redeem failed");
            require(DST_DOLA.Swapout(profit, GOV));
        }
    }

    event Expansion(uint amount);
    event Contraction(uint amount);

}