import type { ComponentType } from 'react'
import { BitcoinIcon } from '../components/common/BitcoinIcon'
import { EthereumIcon } from '../components/common/EthereumIcon'
import { TetherIcon } from '../components/common/TetherIcon'
import { BnbIcon } from '../components/common/BnbIcon'
import { SolanaIcon } from '../components/common/SolanaIcon'
import { UsdcIcon } from '../components/common/UsdcIcon'
import { XrpIcon } from '../components/common/XrpIcon'
import { DogecoinIcon } from '../components/common/DogecoinIcon'
import { CardanoIcon } from '../components/common/CardanoIcon'
import { TronIcon } from '../components/common/TronIcon'
import { TonIcon } from '../components/common/TonIcon'
import { LitecoinIcon } from '../components/common/LitecoinIcon'
import { ChainlinkIcon } from '../components/common/ChainlinkIcon'
import { AvalancheIcon } from '../components/common/AvalancheIcon'
import { ShibaInuIcon } from '../components/common/ShibaInuIcon'
import { PolkadotIcon } from '../components/common/PolkadotIcon'
import { BitcoinCashIcon } from '../components/common/BitcoinCashIcon'
import { PolygonIcon } from '../components/common/PolygonIcon'
import { UniswapIcon } from '../components/common/UniswapIcon'
import { StellarIcon } from '../components/common/StellarIcon'

// CoinGecko coin ids (same ids CryptoEntry.coinId stores — see
// lib/constants's POPULAR_COINS and CryptoEntryForm's custom-id field) for
// the ~20 most widely held cryptocurrencies. Anything not listed here (a
// less common pick, or a custom coinId typed in) keeps the generic
// fa-coins icon every crypto entry showed before this existed.
export const CRYPTO_ICON_BY_COIN_ID: Record<string, ComponentType<{ size?: number }>> = {
  bitcoin: BitcoinIcon,
  ethereum: EthereumIcon,
  tether: TetherIcon,
  binancecoin: BnbIcon,
  solana: SolanaIcon,
  'usd-coin': UsdcIcon,
  ripple: XrpIcon,
  dogecoin: DogecoinIcon,
  cardano: CardanoIcon,
  tron: TronIcon,
  'the-open-network': TonIcon,
  litecoin: LitecoinIcon,
  chainlink: ChainlinkIcon,
  'avalanche-2': AvalancheIcon,
  'shiba-inu': ShibaInuIcon,
  polkadot: PolkadotIcon,
  'bitcoin-cash': BitcoinCashIcon,
  'matic-network': PolygonIcon,
  uniswap: UniswapIcon,
  stellar: StellarIcon,
}
