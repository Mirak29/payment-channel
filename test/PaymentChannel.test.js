"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const hardhat_1 = require("hardhat");
describe("PaymentChannel", function () {
    let thdToken;
    let paymentChannel;
    let owner;
    let partA;
    let partB;
    let other;
    const INITIAL_SUPPLY = hardhat_1.ethers.parseEther("1000");
    const CHANNEL_AMOUNT = hardhat_1.ethers.parseEther("100");
    beforeEach(async function () {
        [owner, partA, partB, other] = await hardhat_1.ethers.getSigners();
        // Deploy THD token
        const THDTokenFactory = await hardhat_1.ethers.getContractFactory("THDToken");
        thdToken = await THDTokenFactory.deploy(1000);
        await thdToken.waitForDeployment();
        // Transfer tokens to participants
        await thdToken.transfer(partA.address, hardhat_1.ethers.parseEther("200"));
        await thdToken.transfer(partB.address, hardhat_1.ethers.parseEther("200"));
        // Deploy PaymentChannel
        const PaymentChannelFactory = await hardhat_1.ethers.getContractFactory("PaymentChannel");
        paymentChannel = await PaymentChannelFactory.deploy(partA.address, partB.address, CHANNEL_AMOUNT, await thdToken.getAddress());
        await paymentChannel.waitForDeployment();
    });
    describe("Deployment", function () {
        it("Should set the right participants", async function () {
            (0, chai_1.expect)(await paymentChannel.partA()).to.equal(partA.address);
            (0, chai_1.expect)(await paymentChannel.partB()).to.equal(partB.address);
        });
        it("Should set the right amount", async function () {
            (0, chai_1.expect)(await paymentChannel.amount()).to.equal(CHANNEL_AMOUNT);
        });
        it("Should initialize with EMPTY state", async function () {
            (0, chai_1.expect)(await paymentChannel.state()).to.equal(0); // EMPTY
        });
        it("Should revert with invalid addresses", async function () {
            const PaymentChannelFactory = await hardhat_1.ethers.getContractFactory("PaymentChannel");
            await (0, chai_1.expect)(PaymentChannelFactory.deploy(hardhat_1.ethers.ZeroAddress, partB.address, CHANNEL_AMOUNT, await thdToken.getAddress())).to.be.revertedWith("Invalid addresses");
            await (0, chai_1.expect)(PaymentChannelFactory.deploy(partA.address, partA.address, CHANNEL_AMOUNT, await thdToken.getAddress())).to.be.revertedWith("Participants must be different");
        });
    });
    describe("Funding", function () {
        it("Should allow participants to fund the channel", async function () {
            // Approve spending
            await thdToken.connect(partA).approve(await paymentChannel.getAddress(), CHANNEL_AMOUNT);
            await thdToken.connect(partB).approve(await paymentChannel.getAddress(), CHANNEL_AMOUNT);
            // Fund from partA
            await (0, chai_1.expect)(paymentChannel.connect(partA).fund())
                .to.emit(paymentChannel, "ChannelFunded")
                .withArgs(partA.address, CHANNEL_AMOUNT);
            // Fund from partB
            await (0, chai_1.expect)(paymentChannel.connect(partB).fund())
                .to.emit(paymentChannel, "ChannelFunded")
                .withArgs(partB.address, CHANNEL_AMOUNT);
            // Check state is now ACTIVE
            (0, chai_1.expect)(await paymentChannel.state()).to.equal(1); // ACTIVE
        });
        it("Should not allow non-participants to fund", async function () {
            await thdToken.connect(other).approve(await paymentChannel.getAddress(), CHANNEL_AMOUNT);
            await (0, chai_1.expect)(paymentChannel.connect(other).fund())
                .to.be.revertedWith("Only channel participants");
        });
        it("Should not allow funding twice", async function () {
            await thdToken.connect(partA).approve(await paymentChannel.getAddress(), CHANNEL_AMOUNT * 2n);
            await thdToken.connect(partB).approve(await paymentChannel.getAddress(), CHANNEL_AMOUNT * 2n);
            await paymentChannel.connect(partA).fund();
            await paymentChannel.connect(partB).fund();
            // Try to fund again
            await (0, chai_1.expect)(paymentChannel.connect(partA).fund())
                .to.be.revertedWith("Invalid channel state");
        });
    });
    describe("Message hashing", function () {
        it("Should generate consistent message hashes", async function () {
            const nonce = 1;
            const balanceA = hardhat_1.ethers.parseEther("80");
            const balanceB = hardhat_1.ethers.parseEther("120");
            const hash1 = await paymentChannel.message(nonce, balanceA, balanceB);
            const hash2 = await paymentChannel.message(nonce, balanceA, balanceB);
            (0, chai_1.expect)(hash1).to.equal(hash2);
            // Test that different values produce different hashes
            const hash3 = await paymentChannel.message(nonce + 1, balanceA, balanceB);
            (0, chai_1.expect)(hash1).to.not.equal(hash3);
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
            const balanceA = hardhat_1.ethers.parseEther("80");
            const balanceB = hardhat_1.ethers.parseEther("120");
            // Create message hash
            const messageHash = await paymentChannel.message(nonce, balanceA, balanceB);
            const ethSignedMessageHash = hardhat_1.ethers.hashMessage(hardhat_1.ethers.getBytes(messageHash));
            // Sign by partB (other party)
            const signature = await partB.signMessage(hardhat_1.ethers.getBytes(messageHash));
            // Close by partA
            await (0, chai_1.expect)(paymentChannel.connect(partA).closing(nonce, balanceA, balanceB, signature)).to.emit(paymentChannel, "ChannelClosed")
                .withArgs(nonce, balanceA, balanceB);
            (0, chai_1.expect)(await paymentChannel.state()).to.equal(2); // CLOSING
        });
        it("Should not allow closing with invalid balances", async function () {
            const nonce = 1;
            const balanceA = hardhat_1.ethers.parseEther("90");
            const balanceB = hardhat_1.ethers.parseEther("90"); // Total doesn't equal channel amount * 2
            const messageHash = await paymentChannel.message(nonce, balanceA, balanceB);
            const signature = await partB.signMessage(hardhat_1.ethers.getBytes(messageHash));
            await (0, chai_1.expect)(paymentChannel.connect(partA).closing(nonce, balanceA, balanceB, signature)).to.be.revertedWith("Invalid balances");
        });
        it("Should not allow closing with old nonce", async function () {
            const nonce = 0; // Same as initial nonce
            const balanceA = hardhat_1.ethers.parseEther("100");
            const balanceB = hardhat_1.ethers.parseEther("100");
            const messageHash = await paymentChannel.message(nonce, balanceA, balanceB);
            const signature = await partB.signMessage(hardhat_1.ethers.getBytes(messageHash));
            await (0, chai_1.expect)(paymentChannel.connect(partA).closing(nonce, balanceA, balanceB, signature)).to.be.revertedWith("Nonce must be greater than current");
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
            const balanceA = hardhat_1.ethers.parseEther("80");
            const balanceB = hardhat_1.ethers.parseEther("120");
            const messageHash = await paymentChannel.message(nonce, balanceA, balanceB);
            const signature = await partB.signMessage(hardhat_1.ethers.getBytes(messageHash));
            await paymentChannel.connect(partA).closing(nonce, balanceA, balanceB, signature);
        });
        it("Should not allow withdrawal before challenge period", async function () {
            await (0, chai_1.expect)(paymentChannel.connect(partA).withdraw())
                .to.be.revertedWith("Challenge period not over");
        });
        it("Should allow withdrawal after challenge period", async function () {
            // Mine 24 blocks
            for (let i = 0; i < 24; i++) {
                await hardhat_1.ethers.provider.send("evm_mine", []);
            }
            const initialBalance = await thdToken.balanceOf(partA.address);
            await (0, chai_1.expect)(paymentChannel.connect(partA).withdraw())
                .to.emit(paymentChannel, "ChannelWithdrawn")
                .withArgs(partA.address, hardhat_1.ethers.parseEther("80"));
            const finalBalance = await thdToken.balanceOf(partA.address);
            (0, chai_1.expect)(finalBalance - initialBalance).to.equal(hardhat_1.ethers.parseEther("80"));
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
            const balanceA = hardhat_1.ethers.parseEther("80");
            const balanceB = hardhat_1.ethers.parseEther("120");
            const messageHash = await paymentChannel.message(nonce, balanceA, balanceB);
            const signature = await partB.signMessage(hardhat_1.ethers.getBytes(messageHash));
            await paymentChannel.connect(partA).closing(nonce, balanceA, balanceB, signature);
        });
        it("Should allow successful challenge with higher nonce", async function () {
            const higherNonce = 2;
            const newBalanceA = hardhat_1.ethers.parseEther("60");
            const newBalanceB = hardhat_1.ethers.parseEther("140");
            const messageHash = await paymentChannel.message(higherNonce, newBalanceA, newBalanceB);
            const signature = await partA.signMessage(hardhat_1.ethers.getBytes(messageHash)); // Signed by partA this time
            await (0, chai_1.expect)(paymentChannel.connect(partB).challenge(higherNonce, newBalanceA, newBalanceB, signature)).to.emit(paymentChannel, "ChannelChallenged")
                .withArgs(partB.address, higherNonce);
            // Challenger (partB) should get full amount
            (0, chai_1.expect)(await paymentChannel.balanceA()).to.equal(0);
            (0, chai_1.expect)(await paymentChannel.balanceB()).to.equal(CHANNEL_AMOUNT * 2n);
            (0, chai_1.expect)(await paymentChannel.state()).to.equal(3); // CLOSED
        });
        it("Should not allow challenge with lower nonce", async function () {
            const lowerNonce = 1; // Same as closing nonce
            const balanceA = hardhat_1.ethers.parseEther("50");
            const balanceB = hardhat_1.ethers.parseEther("150");
            const messageHash = await paymentChannel.message(lowerNonce, balanceA, balanceB);
            const signature = await partA.signMessage(hardhat_1.ethers.getBytes(messageHash));
            await (0, chai_1.expect)(paymentChannel.connect(partB).challenge(lowerNonce, balanceA, balanceB, signature)).to.be.revertedWith("Nonce must be greater than current");
        });
    });
    describe("Channel info", function () {
        it("Should return correct channel information", async function () {
            const info = await paymentChannel.getChannelInfo();
            (0, chai_1.expect)(info[0]).to.equal(0); // EMPTY state
            (0, chai_1.expect)(info[1]).to.equal(0); // nonce
            (0, chai_1.expect)(info[2]).to.equal(0); // balanceA
            (0, chai_1.expect)(info[3]).to.equal(0); // balanceB
            (0, chai_1.expect)(info[4]).to.equal(0); // closingBlock
            (0, chai_1.expect)(info[5]).to.equal(0); // contractBalance
        });
    });
});
//# sourceMappingURL=PaymentChannel.test.js.map