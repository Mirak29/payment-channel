// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract PaymentChannel {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    enum StateChannel {
        EMPTY,
        ACTIVE,
        CLOSING,
        CLOSED
    }

    address public partA;
    address public partB;
    uint256 public amount;
    StateChannel public state;
    uint256 public closingBlock;
    uint256 public nonce;
    uint256 public balanceA;
    uint256 public balanceB;
    IERC20 public token;

    uint256 public constant CHALLENGE_PERIOD = 24; // 24 blocks (about 6 minutes)

    event ChannelFunded(address indexed funder, uint256 amount);
    event ChannelClosed(uint256 nonce, uint256 balanceA, uint256 balanceB);
    event ChannelWithdrawn(address indexed participant, uint256 amount);
    event ChannelChallenged(address indexed challenger, uint256 newNonce);

    modifier onlyParticipants() {
        require(msg.sender == partA || msg.sender == partB, "Only channel participants");
        _;
    }

    modifier onlyState(StateChannel _state) {
        require(state == _state, "Invalid channel state");
        _;
    }

    constructor(address _partA, address _partB, uint256 _amount, address _token) {
        require(_partA != address(0) && _partB != address(0), "Invalid addresses");
        require(_partA != _partB, "Participants must be different");
        require(_amount > 0, "Amount must be positive");
        
        partA = _partA;
        partB = _partB;
        amount = _amount;
        token = IERC20(_token);
        state = StateChannel.EMPTY;
        nonce = 0;
        balanceA = 0;
        balanceB = 0;
    }

    function fund() external onlyParticipants onlyState(StateChannel.EMPTY) {
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        if (msg.sender == partA) {
            balanceA = amount;
        } else {
            balanceB = amount;
        }

        // Check if both parties have funded
        if (token.balanceOf(address(this)) == amount * 2) {
            state = StateChannel.ACTIVE;
        }

        emit ChannelFunded(msg.sender, amount);
    }

    function message(uint256 _nonce, uint256 _balanceA, uint256 _balanceB) 
        public 
        pure 
        returns (bytes32) 
    {
        return keccak256(abi.encodePacked(_nonce, _balanceA, _balanceB));
    }

    function closing(
        uint256 _nonce,
        uint256 _balanceA,
        uint256 _balanceB,
        bytes memory _signature
    ) external onlyParticipants onlyState(StateChannel.ACTIVE) {
        require(_balanceA + _balanceB == amount * 2, "Invalid balances");
        require(_nonce > nonce, "Nonce must be greater than current");

        bytes32 messageHash = message(_nonce, _balanceA, _balanceB);
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        
        address signer = ethSignedMessageHash.recover(_signature);
        address otherParty = (msg.sender == partA) ? partB : partA;
        require(signer == otherParty, "Invalid signature");

        nonce = _nonce;
        balanceA = _balanceA;
        balanceB = _balanceB;
        closingBlock = block.number;
        state = StateChannel.CLOSING;

        emit ChannelClosed(_nonce, _balanceA, _balanceB);
    }

    function withdraw() external onlyParticipants onlyState(StateChannel.CLOSING) {
        require(block.number >= closingBlock + CHALLENGE_PERIOD, "Challenge period not over");

        uint256 withdrawAmount;
        if (msg.sender == partA) {
            withdrawAmount = balanceA;
            balanceA = 0;
        } else {
            withdrawAmount = balanceB;
            balanceB = 0;
        }

        require(withdrawAmount > 0, "No balance to withdraw");
        require(token.transfer(msg.sender, withdrawAmount), "Transfer failed");

        // If both parties have withdrawn, close the channel
        if (balanceA == 0 && balanceB == 0) {
            state = StateChannel.CLOSED;
        }

        emit ChannelWithdrawn(msg.sender, withdrawAmount);
    }

    function challenge(
        uint256 _nonce,
        uint256 _balanceA,
        uint256 _balanceB,
        bytes memory _signature
    ) external onlyParticipants onlyState(StateChannel.CLOSING) {
        require(_nonce > nonce, "Nonce must be greater than current");
        require(_balanceA + _balanceB == amount * 2, "Invalid balances");

        bytes32 messageHash = message(_nonce, _balanceA, _balanceB);
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        
        address signer = ethSignedMessageHash.recover(_signature);
        address otherParty = (msg.sender == partA) ? partB : partA;
        require(signer == otherParty, "Invalid signature");

        // Challenger wins the full amount
        uint256 fullAmount = token.balanceOf(address(this));
        if (msg.sender == partA) {
            balanceA = fullAmount;
            balanceB = 0;
        } else {
            balanceA = 0;
            balanceB = fullAmount;
        }

        state = StateChannel.CLOSED;

        emit ChannelChallenged(msg.sender, _nonce);
    }

    function getChannelInfo() external view returns (
        StateChannel _state,
        uint256 _nonce,
        uint256 _balanceA,
        uint256 _balanceB,
        uint256 _closingBlock,
        uint256 _contractBalance
    ) {
        return (
            state,
            nonce,
            balanceA,
            balanceB,
            closingBlock,
            token.balanceOf(address(this))
        );
    }
}