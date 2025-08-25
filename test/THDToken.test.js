"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const hardhat_1 = require("hardhat");
describe("THDToken", function () {
    let thdToken;
    let owner;
    let addr1;
    let addr2;
    const INITIAL_SUPPLY = 1000;
    beforeEach(async function () {
        [owner, addr1, addr2] = await hardhat_1.ethers.getSigners();
        const THDTokenFactory = await hardhat_1.ethers.getContractFactory("THDToken");
        thdToken = await THDTokenFactory.deploy(INITIAL_SUPPLY);
        await thdToken.waitForDeployment();
    });
    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            (0, chai_1.expect)(await thdToken.owner()).to.equal(owner.address);
        });
        it("Should assign the total supply of tokens to the owner", async function () {
            const ownerBalance = await thdToken.balanceOf(owner.address);
            (0, chai_1.expect)(await thdToken.totalSupply()).to.equal(ownerBalance);
        });
        it("Should set the correct name and symbol", async function () {
            (0, chai_1.expect)(await thdToken.name()).to.equal("Thunder Token");
            (0, chai_1.expect)(await thdToken.symbol()).to.equal("THD");
        });
        it("Should have 18 decimals", async function () {
            (0, chai_1.expect)(await thdToken.decimals()).to.equal(18);
        });
        it("Should have correct initial supply", async function () {
            const expectedSupply = hardhat_1.ethers.parseEther(INITIAL_SUPPLY.toString());
            (0, chai_1.expect)(await thdToken.totalSupply()).to.equal(expectedSupply);
        });
    });
    describe("Transfers", function () {
        it("Should transfer tokens between accounts", async function () {
            const transferAmount = hardhat_1.ethers.parseEther("50");
            await (0, chai_1.expect)(thdToken.transfer(addr1.address, transferAmount))
                .to.emit(thdToken, "Transfer")
                .withArgs(owner.address, addr1.address, transferAmount);
            (0, chai_1.expect)(await thdToken.balanceOf(addr1.address)).to.equal(transferAmount);
        });
        it("Should fail if sender doesn't have enough tokens", async function () {
            const initialOwnerBalance = await thdToken.balanceOf(owner.address);
            const transferAmount = initialOwnerBalance + 1n;
            await (0, chai_1.expect)(thdToken.connect(addr1).transfer(owner.address, transferAmount)).to.be.revertedWithCustomError(thdToken, "ERC20InsufficientBalance");
        });
        it("Should update balances after transfers", async function () {
            const transferAmount = hardhat_1.ethers.parseEther("100");
            const initialOwnerBalance = await thdToken.balanceOf(owner.address);
            await thdToken.transfer(addr1.address, transferAmount);
            (0, chai_1.expect)(await thdToken.balanceOf(owner.address)).to.equal(initialOwnerBalance - transferAmount);
            (0, chai_1.expect)(await thdToken.balanceOf(addr1.address)).to.equal(transferAmount);
        });
    });
    describe("Allowances", function () {
        it("Should approve token spending", async function () {
            const approveAmount = hardhat_1.ethers.parseEther("100");
            await (0, chai_1.expect)(thdToken.approve(addr1.address, approveAmount))
                .to.emit(thdToken, "Approval")
                .withArgs(owner.address, addr1.address, approveAmount);
            (0, chai_1.expect)(await thdToken.allowance(owner.address, addr1.address)).to.equal(approveAmount);
        });
        it("Should allow approved transfers", async function () {
            const approveAmount = hardhat_1.ethers.parseEther("100");
            const transferAmount = hardhat_1.ethers.parseEther("50");
            await thdToken.approve(addr1.address, approveAmount);
            await (0, chai_1.expect)(thdToken.connect(addr1).transferFrom(owner.address, addr2.address, transferAmount)).to.emit(thdToken, "Transfer")
                .withArgs(owner.address, addr2.address, transferAmount);
            (0, chai_1.expect)(await thdToken.balanceOf(addr2.address)).to.equal(transferAmount);
            (0, chai_1.expect)(await thdToken.allowance(owner.address, addr1.address)).to.equal(approveAmount - transferAmount);
        });
        it("Should fail transfer if not approved", async function () {
            const transferAmount = hardhat_1.ethers.parseEther("50");
            await (0, chai_1.expect)(thdToken.connect(addr1).transferFrom(owner.address, addr2.address, transferAmount)).to.be.revertedWithCustomError(thdToken, "ERC20InsufficientAllowance");
        });
    });
    describe("Minting", function () {
        it("Should allow owner to mint tokens", async function () {
            const mintAmount = hardhat_1.ethers.parseEther("500");
            const initialSupply = await thdToken.totalSupply();
            await (0, chai_1.expect)(thdToken.mint(addr1.address, mintAmount))
                .to.emit(thdToken, "Transfer")
                .withArgs(hardhat_1.ethers.ZeroAddress, addr1.address, mintAmount);
            (0, chai_1.expect)(await thdToken.balanceOf(addr1.address)).to.equal(mintAmount);
            (0, chai_1.expect)(await thdToken.totalSupply()).to.equal(initialSupply + mintAmount);
        });
        it("Should not allow non-owner to mint tokens", async function () {
            const mintAmount = hardhat_1.ethers.parseEther("500");
            await (0, chai_1.expect)(thdToken.connect(addr1).mint(addr2.address, mintAmount)).to.be.revertedWithCustomError(thdToken, "OwnableUnauthorizedAccount");
        });
    });
    describe("Burning", function () {
        beforeEach(async function () {
            // Transfer some tokens to addr1 for burning tests
            await thdToken.transfer(addr1.address, hardhat_1.ethers.parseEther("100"));
        });
        it("Should allow token holders to burn their tokens", async function () {
            const burnAmount = hardhat_1.ethers.parseEther("50");
            const initialBalance = await thdToken.balanceOf(addr1.address);
            const initialSupply = await thdToken.totalSupply();
            await (0, chai_1.expect)(thdToken.connect(addr1).burn(burnAmount))
                .to.emit(thdToken, "Transfer")
                .withArgs(addr1.address, hardhat_1.ethers.ZeroAddress, burnAmount);
            (0, chai_1.expect)(await thdToken.balanceOf(addr1.address)).to.equal(initialBalance - burnAmount);
            (0, chai_1.expect)(await thdToken.totalSupply()).to.equal(initialSupply - burnAmount);
        });
        it("Should not allow burning more tokens than balance", async function () {
            const balance = await thdToken.balanceOf(addr1.address);
            const burnAmount = balance + 1n;
            await (0, chai_1.expect)(thdToken.connect(addr1).burn(burnAmount)).to.be.revertedWithCustomError(thdToken, "ERC20InsufficientBalance");
        });
        it("Should allow burning from allowance", async function () {
            const approveAmount = hardhat_1.ethers.parseEther("50");
            const burnAmount = hardhat_1.ethers.parseEther("30");
            // addr1 approves owner to burn tokens
            await thdToken.connect(addr1).approve(owner.address, approveAmount);
            const initialBalance = await thdToken.balanceOf(addr1.address);
            const initialSupply = await thdToken.totalSupply();
            await (0, chai_1.expect)(thdToken.burnFrom(addr1.address, burnAmount))
                .to.emit(thdToken, "Transfer")
                .withArgs(addr1.address, hardhat_1.ethers.ZeroAddress, burnAmount);
            (0, chai_1.expect)(await thdToken.balanceOf(addr1.address)).to.equal(initialBalance - burnAmount);
            (0, chai_1.expect)(await thdToken.totalSupply()).to.equal(initialSupply - burnAmount);
            (0, chai_1.expect)(await thdToken.allowance(addr1.address, owner.address)).to.equal(approveAmount - burnAmount);
        });
    });
});
//# sourceMappingURL=THDToken.test.js.map