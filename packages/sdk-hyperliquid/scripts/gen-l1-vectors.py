# Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/signing
# Digests produced with the official Python SDK: github.com/hyperliquid-dex/hyperliquid-python-sdk (MIT)
# Run: python scripts/gen-l1-vectors.py > test/fixtures/l1-vectors.json

import json
import sys
from importlib.metadata import PackageNotFoundError, version

from eth_account.messages import encode_typed_data
from eth_utils import keccak
from hyperliquid.utils.signing import action_hash, construct_phantom_agent

NONCE = 1700000000000
VAULT = "0x3333333333333333333333333333333333333333"
EXPIRES_AFTER = 1700000300000

DOMAIN = {
    "name": "Exchange",
    "version": "1",
    "chainId": 1337,
    "verifyingContract": "0x0000000000000000000000000000000000000000",
}

TYPES = {
    "Agent": [
        {"name": "source", "type": "string"},
        {"name": "connectionId", "type": "bytes32"},
    ],
}

ORDER = {
    "type": "order",
    "orders": [
        {"a": 4, "b": True, "p": "1100", "s": "0.1", "r": False, "t": {"limit": {"tif": "Gtc"}}}
    ],
    "grouping": "na",
}

ORDER_BUILDER = {
    **ORDER,
    "builder": {"b": "0x2222222222222222222222222222222222222222", "f": 10},
}

CANCEL = {"type": "cancel", "cancels": [{"a": 0, "o": 123}]}

CANCEL_BY_CLOID = {
    "type": "cancelByCloid",
    "cancels": [{"asset": 0, "cloid": "0x0102030405060708090a0b0c0d0e0f10"}],
}

UPDATE_LEVERAGE = {"type": "updateLeverage", "asset": 0, "isCross": True, "leverage": 10}

TWAP_ORDER = {
    "type": "twapOrder",
    "twap": {"a": 0, "b": True, "s": "0.01", "r": False, "m": 10, "t": True},
}

NOOP = {"type": "noop"}

ACTIONS = [
    ("order", ORDER),
    ("order with builder", ORDER_BUILDER),
    ("cancel", CANCEL),
    ("cancelByCloid", CANCEL_BY_CLOID),
    ("updateLeverage", UPDATE_LEVERAGE),
    ("twapOrder", TWAP_ORDER),
    ("noop", NOOP),
]


def sdk_version():
    try:
        return f"hyperliquid-python-sdk=={version('hyperliquid-python-sdk')}"
    except PackageNotFoundError:
        return "unpinned"


def action_digest(action, vault, expires_after, is_mainnet=True):
    connection_id = action_hash(action, vault, NONCE, expires_after)
    phantom = construct_phantom_agent(connection_id, is_mainnet)
    typed = {
        "types": TYPES,
        "primaryType": "Agent",
        "domain": DOMAIN,
        "message": phantom,
    }
    msg = encode_typed_data(full_message=typed)
    return "0x" + keccak(b"\x19" + msg.version + msg.header + msg.body).hex()


def action_hex(action):
    from msgpack import packb

    return "0x" + packb(action).hex()


def variants(name, action):
    for vault_suffix, vault in (("no vault", None), ("vault", VAULT)):
        for expiry_suffix, expires_after in (("no expiry", None), ("expiry", EXPIRES_AFTER)):
            yield {
                "name": f"{name} {vault_suffix} {expiry_suffix}",
                "action": action,
                "actionHex": action_hex(action),
                "packedHex": action_hex(action),
                "nonce": str(NONCE),
                "vault": vault,
                "expiresAfter": None if expires_after is None else str(expires_after),
                "digest": action_digest(action, vault, expires_after),
            }


def main():
    vectors = [vector for name, action in ACTIONS for vector in variants(name, action)]
    payload = {
        "source": "hyperliquid-dex/python-sdk (MIT)",
        "version": sdk_version(),
        "vectors": vectors,
    }
    json.dump(payload, sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
