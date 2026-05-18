import {
    AccountUpdate,
    AccountUpdateForest,
    DeployArgs,
    method,
    Permissions,
    Provable,
    State,
    state,
    TokenContract,
    UInt64,
} from 'o1js';

const SHARE_SYMBOL = 'vMINA';

function mulDivFloor(x: UInt64, y: UInt64, denominator: UInt64): UInt64 {
    denominator.assertGreaterThan(UInt64.zero, 'division by zero');

    const quotient = Provable.witness(UInt64, () => {
        const numerator = x.toBigInt() * y.toBigInt();
        return UInt64.from(numerator / denominator.toBigInt());
    });

    const remainder = Provable.witness(UInt64, () => {
        const numerator = x.toBigInt() * y.toBigInt();
        return UInt64.from(numerator % denominator.toBigInt());
    });

    remainder.assertLessThan(denominator, 'bad floor division remainder');

    x.value
        .mul(y.value)
        .assertEquals(quotient.value.mul(denominator.value).add(remainder.value));

    return quotient;
}

export class MinaVault extends TokenContract {
    @state(UInt64) totalShares = State<UInt64>();
    @state(UInt64) accountedAssets = State<UInt64>();

    async deploy(args?: DeployArgs) {
        await super.deploy(args);

        const proof = Permissions.proof();

        this.account.permissions.set({
            ...Permissions.default(),

            // State changes must go through valid zkApp proofs.
            editState: proof,

            // The vault can only send MINA through proven methods.
            send: proof,

            // Anyone can send MINA to the vault.
            // This is needed for delegation rewards / donations.
            receive: Permissions.none(),

            // The token symbol is set by the contract initialization.
            setTokenSymbol: proof,
        });
    }

    init() {
        super.init();

        this.account.tokenSymbol.set(SHARE_SYMBOL);
        this.totalShares.set(UInt64.zero);
        this.accountedAssets.set(UInt64.zero);
    }

    @method async approveBase(forest: AccountUpdateForest) {
        // External share transfers are allowed, but total token supply cannot change.
        this.checkZeroBalanceChange(forest);
    }

    @method async deposit(amount: UInt64) {
        amount.assertGreaterThan(UInt64.zero, 'deposit amount is zero');

        const sender = this.sender.getAndRequireSignature();

        const totalShares = this.totalShares.getAndRequireEquals();

        // Actual MINA balance before this transaction.
        // If delegation rewards arrived directly, they are already included here.
        const assetsBefore = this.account.balance.getAndRequireEquals();

        const isFirstDeposit = totalShares.equals(UInt64.zero);

        // If there are no shares yet, the vault must not already hold assets.
        // Otherwise the first depositor could capture unowned rewards/dust.
        isFirstDeposit
            .not()
            .or(assetsBefore.equals(UInt64.zero))
            .assertTrue('vault has assets but no shares');

        // If shares exist, the vault must have assets to price new shares.
        isFirstDeposit
            .or(assetsBefore.greaterThan(UInt64.zero))
            .assertTrue('invalid vault accounting');

        const safeDenominator = Provable.if(
            isFirstDeposit,
            UInt64,
            UInt64.one,
            assetsBefore
        );

        const proportionalShares = mulDivFloor(amount, totalShares, safeDenominator);

        const sharesToMint = Provable.if(
            isFirstDeposit,
            UInt64,
            amount,
            proportionalShares
        );

        sharesToMint.assertGreaterThan(UInt64.zero, 'deposit mints zero shares');

        const senderUpdate = AccountUpdate.createSigned(sender);
        senderUpdate.send({ to: this, amount });

        this.internal.mint({
            address: sender,
            amount: sharesToMint,
        });

        this.totalShares.set(totalShares.add(sharesToMint));
        this.accountedAssets.set(assetsBefore.add(amount));
    }

    @method async withdraw(shares: UInt64) {
        shares.assertGreaterThan(UInt64.zero, 'withdraw shares is zero');

        const sender = this.sender.getAndRequireSignature();

        const totalShares = this.totalShares.getAndRequireEquals();
        totalShares.assertGreaterThan(UInt64.zero, 'vault has no shares');

        shares.assertLessThanOrEqual(totalShares, 'not enough vault shares');

        // Includes all rewards already received by the vault.
        const assetsBefore = this.account.balance.getAndRequireEquals();

        const amountOut = mulDivFloor(shares, assetsBefore, totalShares);
        amountOut.assertGreaterThan(UInt64.zero, 'withdraw amount is zero');

        this.internal.burn({
            address: sender,
            amount: shares,
        });

        this.send({
            to: sender,
            amount: amountOut,
        });

        this.totalShares.set(totalShares.sub(shares));
        this.accountedAssets.set(assetsBefore.sub(amountOut));
    }

    @method async depositReward(amount: UInt64) {
        amount.assertGreaterThan(UInt64.zero, 'reward amount is zero');

        const totalShares = this.totalShares.getAndRequireEquals();
        totalShares.assertGreaterThan(UInt64.zero, 'no shareholders');

        const sender = this.sender.getAndRequireSignature();
        const assetsBefore = this.account.balance.getAndRequireEquals();

        const senderUpdate = AccountUpdate.createSigned(sender);
        senderUpdate.send({ to: this, amount });

        // No shares are minted here.
        // Existing holders receive the reward through a higher share price.
        this.accountedAssets.set(assetsBefore.add(amount));
    }

    @method async syncRewards() {
        const totalShares = this.totalShares.getAndRequireEquals();
        totalShares.assertGreaterThan(UInt64.zero, 'no shareholders');

        const accountedAssets = this.accountedAssets.getAndRequireEquals();
        const actualAssets = this.account.balance.getAndRequireEquals();

        actualAssets.assertGreaterThanOrEqual(
            accountedAssets,
            'actual assets below accounted assets'
        );

        // Direct delegation rewards are pulled into accounting.
        this.accountedAssets.set(actualAssets);
    }
}