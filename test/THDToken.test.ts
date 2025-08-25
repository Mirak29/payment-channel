import { expect } from "chai";
import { ethers } from "hardhat";
import { THDToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("THDToken", function () {
  let thdToken: THDToken;
  let owner: HardhatEthersSigner;
  let addr1: HardhatEthersSigner;
  let addr2: HardhatEthersSigner;

  const INITIAL_SUPPLY = 1000;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const THDTokenFactory = await ethers.getContractFactory("THDToken");
    thdToken = await THDTokenFactory.deploy(INITIAL_SUPPLY);
    await thdToken.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await thdToken.owner()).to.equal(owner.address);
    });

    it("Should assign the total supply of tokens to the owner", async function () {
      const ownerBalance = await thdToken.balanceOf(owner.address);
      expect(await thdToken.totalSupply()).to.equal(ownerBalance);
    });

    it("Should set the correct name and symbol", async function () {
      expect(await thdToken.name()).to.equal("Thunder Token");
      expect(await thdToken.symbol()).to.equal("THD");
    });

    it("Should have 18 decimals", async function () {
      expect(await thdToken.decimals()).to.equal(18);
    });

    it("Should have correct initial supply", async function () {
      const expectedSupply = ethers.parseEther(INITIAL_SUPPLY.toString());
      expect(await thdToken.totalSupply()).to.equal(expectedSupply);
    });
  });

  describe("Transfers", function () {
    it("Should transfer tokens between accounts", async function () {
      const transferAmount = ethers.parseEther("50");
      
      await expect(thdToken.transfer(addr1.address, transferAmount))
        .to.emit(thdToken, "Transfer")
        .withArgs(owner.address, addr1.address, transferAmount);

      expect(await thdToken.balanceOf(addr1.address)).to.equal(transferAmount);
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const initialOwnerBalance = await thdToken.balanceOf(owner.address);
      const transferAmount = initialOwnerBalance + 1n;

      await expect(
        thdToken.connect(addr1).transfer(owner.address, transferAmount)
      ).to.be.revertedWithCustomError(thdToken, "ERC20InsufficientBalance");
    });

    it("Should update balances after transfers", async function () {
      const transferAmount = ethers.parseEther("100");
      const initialOwnerBalance = await thdToken.balanceOf(owner.address);

      await thdToken.transfer(addr1.address, transferAmount);

      expect(await thdToken.balanceOf(owner.address)).to.equal(
        initialOwnerBalance - transferAmount
      );
      expect(await thdToken.balanceOf(addr1.address)).to.equal(transferAmount);
    });
  });

  describe("Allowances", function () {
    it("Should approve token spending", async function () {
      const approveAmount = ethers.parseEther("100");

      await expect(thdToken.approve(addr1.address, approveAmount))
        .to.emit(thdToken, "Approval")
        .withArgs(owner.address, addr1.address, approveAmount);

      expect(await thdToken.allowance(owner.address, addr1.address)).to.equal(
        approveAmount
      );
    });

    it("Should allow approved transfers", async function () {
      const approveAmount = ethers.parseEther("100");
      const transferAmount = ethers.parseEther("50");

      await thdToken.approve(addr1.address, approveAmount);
      
      await expect(
        thdToken.connect(addr1).transferFrom(owner.address, addr2.address, transferAmount)
      ).to.emit(thdToken, "Transfer")
       .withArgs(owner.address, addr2.address, transferAmount);

      expect(await thdToken.balanceOf(addr2.address)).to.equal(transferAmount);
      expect(await thdToken.allowance(owner.address, addr1.address)).to.equal(
        approveAmount - transferAmount
      );
    });

    it("Should fail transfer if not approved", async function () {
      const transferAmount = ethers.parseEther("50");

      await expect(
        thdToken.connect(addr1).transferFrom(owner.address, addr2.address, transferAmount)
      ).to.be.revertedWithCustomError(thdToken, "ERC20InsufficientAllowance");
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint tokens", async function () {
      const mintAmount = ethers.parseEther("500");
      const initialSupply = await thdToken.totalSupply();

      await expect(thdToken.mint(addr1.address, mintAmount))
        .to.emit(thdToken, "Transfer")
        .withArgs(ethers.ZeroAddress, addr1.address, mintAmount);

      expect(await thdToken.balanceOf(addr1.address)).to.equal(mintAmount);
      expect(await thdToken.totalSupply()).to.equal(initialSupply + mintAmount);
    });

    it("Should not allow non-owner to mint tokens", async function () {
      const mintAmount = ethers.parseEther("500");

      await expect(
        thdToken.connect(addr1).mint(addr2.address, mintAmount)
      ).to.be.revertedWithCustomError(thdToken, "OwnableUnauthorizedAccount");
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      // Transfer some tokens to addr1 for burning tests
      await thdToken.transfer(addr1.address, ethers.parseEther("100"));
    });

    it("Should allow token holders to burn their tokens", async function () {
      const burnAmount = ethers.parseEther("50");
      const initialBalance = await thdToken.balanceOf(addr1.address);
      const initialSupply = await thdToken.totalSupply();

      await expect(thdToken.connect(addr1).burn(burnAmount))
        .to.emit(thdToken, "Transfer")
        .withArgs(addr1.address, ethers.ZeroAddress, burnAmount);

      expect(await thdToken.balanceOf(addr1.address)).to.equal(
        initialBalance - burnAmount
      );
      expect(await thdToken.totalSupply()).to.equal(initialSupply - burnAmount);
    });

    it("Should not allow burning more tokens than balance", async function () {
      const balance = await thdToken.balanceOf(addr1.address);
      const burnAmount = balance + 1n;

      await expect(
        thdToken.connect(addr1).burn(burnAmount)
      ).to.be.revertedWithCustomError(thdToken, "ERC20InsufficientBalance");
    });

    it("Should allow burning from allowance", async function () {
      const approveAmount = ethers.parseEther("50");
      const burnAmount = ethers.parseEther("30");

      // addr1 approves owner to burn tokens
      await thdToken.connect(addr1).approve(owner.address, approveAmount);

      const initialBalance = await thdToken.balanceOf(addr1.address);
      const initialSupply = await thdToken.totalSupply();

      await expect(thdToken.burnFrom(addr1.address, burnAmount))
        .to.emit(thdToken, "Transfer")
        .withArgs(addr1.address, ethers.ZeroAddress, burnAmount);

      expect(await thdToken.balanceOf(addr1.address)).to.equal(
        initialBalance - burnAmount
      );
      expect(await thdToken.totalSupply()).to.equal(initialSupply - burnAmount);
      expect(await thdToken.allowance(addr1.address, owner.address)).to.equal(
        approveAmount - burnAmount
      );
    });
  });
});