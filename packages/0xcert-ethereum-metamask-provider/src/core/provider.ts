import { GenericProvider, ProviderEvent, SignMethod } from '@0xcert/ethereum-generic-provider';

/**
 * Metamask provider options interface.
 */
export interface MetamaskProviderOptions {

  /**
   * Type of signature that will be used in making claims etc.
   */
  signMethod?: SignMethod;

  /**
   * List of addresses where normal transfer not safeTransfer smart contract methods will be used.
   */
  unsafeRecipientIds?: string[];

  /**
   * Source where assetLedger compiled smart contract is located.
   */
  assetLedgerSource?: string;

  /**
   * Source where valueLedger compiled smart contract is located.
   */
  valueLedgerSource?: string;

  /**
   * Number of confirmations (blocks in blockchain after mutation is accepted) are necessary to mark a mutation complete.
   */
  requiredConfirmations?: number;

  /**
   * Id (address) of order gateway.
   */
  orderGatewayId?: string;
}

/**
 * Metamask RPC client.
 */
export class MetamaskProvider extends GenericProvider {

  /**
   * Gets an instance of metamask provider.
   */
  public static getInstance(): MetamaskProvider {
    return new MetamaskProvider();
  }

  /**
   * Class constructor.
   */
  public constructor(options?: MetamaskProviderOptions) {
    super({
      ...options,
      client: typeof window !== 'undefined' ? window['ethereum'] : null,
      signMethod: SignMethod.EIP712,
    });

    if (this.isSupported()) {
      window['ethereum'].on('accountsChanged', (accounts) => {
        this.accountId = accounts[0];
      });
      window['ethereum'].on('networkChanged', (netId) => {
        this.emit(ProviderEvent.NETWORK_CHANGE, netId);
      });
    }
  }

  /**
   * Checks if metamask is available.
   */
  public isSupported() {
    return (
      typeof window !== 'undefined'
      && typeof window['ethereum'] !== 'undefined'
    );
  }

  /**
   * Checks if metamask is enabled.
   */
  public async isEnabled() {
    return (
      this.isSupported()
      && await this.$client._metamask.isApproved()
      && !!this.accountId
    );
  }

  /**
   * Enables metamask.
   */
  public async enable() {
    if (this.isSupported()) {
      this.accountId = await this.$client.enable().then((a) => a[0]);
    }
    return this;
  }

}
