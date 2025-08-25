import { expect } from "chai";
import { ethers } from "hardhat";
import { THDToken, PaymentChannel } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("PaymentChannel", function () {
  let thdToken: THDToken;
  let paymentChannel: PaymentChannel;
  let owner: HardhatEthersSigner;
  let partA: HardhatEthersSigner;
  let partB: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  const INITIAL_SUPPLY = ethers.parseEther("1000");
  const CHANNEL_AMOUNT = ethers.parseEther("100");

  beforeEach(async function () {
    [owner, partA, partB, other] = await ethers.getSigners();

    // Deploy THD token
    const THDTokenFactory = await ethers.getContractFactory("THDToken");
    thdToken = await THDTokenFactory.deploy(1000);
    await thdToken.waitForDeployment();

    // Transfer tokens to participants
    await thdToken.transfer(partA.address, ethers.parseEther("200"));
    await thdToken.transfer(partB.address, ethers.parseEther("200"));

    // Deploy PaymentChannel
    const PaymentChannelFactory = await ethers.getContractFactory("PaymentChannel");
    paymentChannel = await PaymentChannelFactory.deploy(
      partA.address,
      partB.address,
      CHANNEL_AMOUNT,
      await thdToken.getAddress()
    );
    await paymentChannel.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right participants", async function () {
      expect(await paymentChannel.partA()).to.equal(partA.address);
      expect(await paymentChannel.partB()).to.equal(partB.address);
    });

    it("Should set the right amount", async function () {
      expect(await paymentChannel.amount()).to.equal(CHANNEL_AMOUNT);
    });

    it("Should initialize with EMPTY state", async function () {
      expect(await paymentChannel.state()).to.equal(0); // EMPTY
    });

    it("Should revert with invalid addresses", async function () {
      const PaymentChannelFactory = await ethers.getContractFactory("PaymentChannel");
      
      await expect(
        PaymentChannelFactory.deploy(
          ethers.ZeroAddress,
          partB.address,
          CHANNEL_AMOUNT,
          await thdToken.getAddress()
        )
      ).to.be.revertedWith("Invalid addresses");

      await expect(
        PaymentChannelFactory.deploy(
          partA.address,
          partA.address,
          CHANNEL_AMOUNT,
          await thdToken.getAddress()
        )
      ).to.be.revertedWith("Participants must be different");
    });
  });

  describe("Funding", function () {
    it("Should allow participants to fund the channel", async function () {
      // Approve spending
      await thdToken.connect(partA).approve(await paymentChannel.getAddress(), CHANNEL_AMOUNT);
      await thdToken.connect(partB).approve(await paymentChannel.getAddress(), CHANNEL_AMOUNT);

      // Fund from partA
      await expect(paymentChannel.connect(partA).fund())
        .to.emit(paymentChannel, "ChannelFunded")
        .withArgs(partA.address, CHANNEL_AMOUNT);

      // Fund from partB
      await expect(paymentChannel.connect(partB).fund())
        .to.emit(paymentChannel, "ChannelFunded")
        .withArgs(partB.address, CHANNEL_AMOUNT);

      // Check state is now ACTIVE
      expect(await paymentChannel.state()).to.equal(1); // ACTIVE
    });

    it("Should not allow non-participants to fund", async function () {
      await thdToken.connect(other).approve(await paymentChannel.getAddress(), CHANNEL_AMOUNT);
      
      await expect(paymentChannel.connect(other).fund())
        .to.be.revertedWith("Only channel participants");
    });

    it("Should not allow funding twice", async function () {
      await thdToken.connect(partA).approve(await paymentChannel.getAddress(), CHANNEL_AMOUNT * 2n);
      await thdToken.connect(partB).approve(await paymentChannel.getAddress(), CHANNEL_AMOUNT * 2n);

      await paymentChannel.connect(partA).fund();
      await paymentChannel.connect(partB).fund();

      // Try to fund again
      await expect(paymentChannel.connect(partA).fund())
        .to.be.revertedWith("Invalid channel state");
    });
  });

  describe("Message hashing", function () {
    it("Should generate consistent message hashes", async function () {
      const nonce = 1;
      const balanceA = ethers.parseEther("80");
      const balanceB = ethers.parseEther("120");

      const hash1 = await paymentChannel.message(nonce, balanceA, balanceB);
      const hash2 = await paymentChannel.message(nonce, balanceA, balanceB);
      
      expect(hash1).to.equal(hash2);

      // Test that different values produce different hashes
      const hash3 = await paymentChannel.message(nonce + 1, balanceA, balanceB);
      expect(hash1).to.not.equal(hash3);
    });
  });

  describe("Channel closing", function () {
    beforeEach(async function () {
      // Fund the channel first
      await thdToken.connect(partA).approve(await paymentChannel.getAddress(), CHANNEL_AMOUNT);
      await thdToken.connect(partB).approve(await paymentChannel.getAddress(), CHANNEL_AMOUNT);
      await paymentChannel.connect(partA).fund();
      await paymentChannel.connect(partB).fund();
    });

    it("Should allow closing with valid signature", async function () {
      const nonce = 1;
      const balanceA = ethers.parseEther("80");
      const balanceB = ethers.parseEther("120");

      // Create message hash
      const messageHash = await paymentChannel.message(nonce, balanceA, balanceB);
      const ethSignedMessageHash = ethers.hashMessage(ethers.getBytes(messageHash));
      
      // Sign by partB (other party)
      const signature = await partB.signMessage(ethers.getBytes(messageHash));

      // Close by partA
      await expect(
        paymentChannel.connect(partA).closing(nonce, balanceA, balanceB, signature)
      ).to.emit(paymentChannel, "ChannelClosed")
       .withArgs(nonce, balanceA, balanceB);

      expect(await paymentChannel.state()).to.equal(2); // CLOSING
    });

    it("Should not allow closing with invalid balances", async function () {
      const nonce = 1;
      const balanceA = ethers.parseEther("90");
      const balanceB = ethers.parseEther("90"); // Total doesn't equal channel amount * 2

      const messageHash = await paymentChannel.message(nonce, balanceA, balanceB);
      const signature = await partB.signMessage(ethers.getBytes(messageHash));

      await expect(
        paymentChannel.connect(partA).closing(nonce, balanceA, balanceB, signature)
      ).to.be.revertedWith("Invalid balances");
    });

    it("Should not allow closing with old nonce", async function () {
      const nonce = 0; // Same as initial nonce
      const balanceA = ethers.parseEther("100");
      const balanceB = ethers.parseEther("100");

      const messageHash = await paymentChannel.message(nonce, balanceA, balanceB);
      const signature = await partB.signMessage(ethers.getBytes(messageHash));

      await expect(
        paymentChannel.connect(partA).closing(nonce, balanceA, balanceB, signature)
      ).to.be.revertedWith("Nonce must be greater than current");
    });
  });

  describe("Withdrawal", function () {
    beforeEach(async function () {
      // Fund and close the channel
      await thdToken.connect(partA).approve(await paymentChannel.getAddress(), CHANNEL_AMOUNT);
      await thdToken.connect(partB).approve(await paymentChannel.getAddress(), CHANNEL_AMOUNT);
      await paymentChannel.connect(partA).fund();
      await paymentChannel.connect(partB).fund();

      const nonce = 1;
      const balanceA = ethers.parseEther("80");
      const balanceB = ethers.parseEther("120");

      const messageHash = await paymentChannel.message(nonce, balanceA, balanceB);
      const signature = await partB.signMessage(ethers.getBytes(messageHash));
      
      await paymentChannel.connect(partA).closing(nonce, balanceA, balanceB, signature);
    });

    it("Should not allow withdrawal before challenge period", async function () {
      await expect(paymentChannel.connect(partA).withdraw())
        .to.be.revertedWith("Challenge period not over");
    });

    it("Should allow withdrawal after challenge period", async function () {
      // Mine 24 blocks
      for (let i = 0; i < 24; i++) {
        await ethers.provider.send("evm_mine", []);
      }

      const initialBalance = await thdToken.balanceOf(partA.address);
      
      await expect(paymentChannel.connect(partA).withdraw())
        .to.emit(paymentChannel, "ChannelWithdrawn")
        .withArgs(partA.address, ethers.parseEther("80"));

      const finalBalance = await thdToken.balanceOf(partA.address);
      expect(finalBalance - initialBalance).to.equal(ethers.parseEther("80"));
    });
  });

  describe("Challenge", function () {
    beforeEach(async function () {
      // Fund and close the channel
      await thdToken.connect(partA).approve(await paymentChannel.getAddress(), CHANNEL_AMOUNT);
      await thdToken.connect(partB).approve(await paymentChannel.getAddress(), CHANNEL_AMOUNT);
      await paymentChannel.connect(partA).fund();
      await paymentChannel.connect(partB).fund();

      const nonce = 1;
      const balanceA = ethers.parseEther("80");
      const balanceB = ethers.parseEther("120");

      const messageHash = await paymentChannel.message(nonce, balanceA, balanceB);
      const signature = await partB.signMessage(ethers.getBytes(messageHash));
      
      await paymentChannel.connect(partA).closing(nonce, balanceA, balanceB, signature);
    });

    it("Should allow successful challenge with higher nonce", async function () {
      const higherNonce = 2;
      const newBalanceA = ethers.parseEther("60");
      const newBalanceB = ethers.parseEther("140");

      const messageHash = await paymentChannel.message(higherNonce, newBalanceA, newBalanceB);
      const signature = await partA.signMessage(ethers.getBytes(messageHash)); // Signed by partA this time

      await expect(
        paymentChannel.connect(partB).challenge(higherNonce, newBalanceA, newBalanceB, signature)
      ).to.emit(paymentChannel, "ChannelChallenged")
       .withArgs(partB.address, higherNonce);

      // Challenger (partB) should get full amount
      expect(await paymentChannel.balanceA()).to.equal(0);
      expect(await paymentChannel.balanceB()).to.equal(CHANNEL_AMOUNT * 2n);
      expect(await paymentChannel.state()).to.equal(3); // CLOSED
    });

    it("Should not allow challenge with lower nonce", async function () {
      const lowerNonce = 1; // Same as closing nonce
      const balanceA = ethers.parseEther("50");
      const balanceB = ethers.parseEther("150");

      const messageHash = await paymentChannel.message(lowerNonce, balanceA, balanceB);
      const signature = await partA.signMessage(ethers.getBytes(messageHash));

      await expect(
        paymentChannel.connect(partB).challenge(lowerNonce, balanceA, balanceB, signature)
      ).to.be.revertedWith("Nonce must be greater than current");
    });
  });

  describe("Channel info", function () {
    it("Should return correct channel information", async function () {
      const info = await paymentChannel.getChannelInfo();
      
      expect(info[0]).to.equal(0); // EMPTY state
      expect(info[1]).to.equal(0); // nonce
      expect(info[2]).to.equal(0); // balanceA
      expect(info[3]).to.equal(0); // balanceB
      expect(info[4]).to.equal(0); // closingBlock
      expect(info[5]).to.equal(0); // contractBalance
    });
  });
});