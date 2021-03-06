import { MutationBase } from './mutation';

/**
 * List of available order action kinds.
 */
export enum OrderActionKind {
  CREATE_ASSET = 1,
  TRANSFER_ASSET = 2,
  TRANSFER_VALUE = 3,
}

/**
 * Order gateway method definition.
 */
export interface OrderGatewayBase {

  /**
   * Address of the smart contract that represents this order gateway.
   */
  readonly id: string;

  /**
   * Gets signed claim for an order.
   * @param order Order data.
   */
  claim(order: Order): Promise<string>;

  /**
   * Performs an order.
   * @param order Order data.
   * @param claim Claim data.
   */
  perform(order: Order, claim: string): Promise<MutationBase>;

  /**
   * Cancels an order.
   * @param order Order data.
   */
  cancel(order: Order): Promise<MutationBase>;
}

/**
 * Different order actions.
 */
export type OrderAction = OrderActionCreateAsset | OrderActionTransferAsset
  | OrderActionTransferValue;

/**
 * Order create asset data definitio.
 */
export interface OrderActionCreateAsset {

  /**
   * Type od order action.
   */
  kind: OrderActionKind.CREATE_ASSET;

  /**
   * Id (address) of the smart contract that represents the assetLedger.
   */
  ledgerId: string;

  /**
   * Id (address) of the sender.
   */
  senderId: string;

  /**
   * Id (address) of the receiver.
   */
  receiverId: string;

  /**
   * Unique asset Id.
   */
  assetId: string;

  /**
   * Merkle tree root of asset proof.
   */
  assetImprint: string;
}

/**
 * Order transfer asset data definition.
 */
export interface OrderActionTransferAsset {

  /**
   * Type od order action.
   */
  kind: OrderActionKind.TRANSFER_ASSET;

  /**
   * Id (address) of the smart contract that represents the assetLedger.
   */
  ledgerId: string;

  /**
   * Id (address) of the sender.
   */
  senderId: string;

  /**
   * Id (address) of the receiver.
   */
  receiverId: string;

  /**
   * Unique asset Id.
   */
  assetId: string;
}

/**
 * Order transfer value data definition.
 */
export interface OrderActionTransferValue {

  /**
   * Type od order action.
   */
  kind: OrderActionKind.TRANSFER_VALUE;

  /**
   * Id (address) of the smart contract that represents the assetLedger.
   */
  ledgerId: string;

  /**
   * Id (address) of the sender.
   */
  senderId: string;

  /**
   * Id (address) of the receiver.
   */
  receiverId: string;

  /**
   * The amount of value(erc20 tokens).
   */
  value: string; // TODO BN.js
}

/**
 * Order definition.
 */
export class Order {

  /**
   * Address of the order maker.
   */
  public makerId: string;

  /**
   * Address of the order taker.
   */
  public takerId: string;

  /**
   * Array of actions that will execute in this order.
   */
  public actions: OrderAction[];

  /**
   * Nonce for hash generation - usually current timestamp.
   */
  public seed: number;

  /**
   * Timestamp of order expiration.
   */
  public expiration: number;
}
