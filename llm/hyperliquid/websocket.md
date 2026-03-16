# Websocket

WebSocket endpoints are available for real-time data streaming and as an alternative to HTTP request sending on the Hyperliquid exchange. The WebSocket URLs by network are:

- Mainnet: `wss://api.hyperliquid.xyz/ws`&#x20;
- Testnet: `wss://api.hyperliquid-testnet.xyz/ws`.

### Connecting

To connect to the WebSocket API, establish a WebSocket connection to the respective URL based on the desired network. Once connected, you can start sending subscription messages to receive real-time data updates.

Example from command line:

```
$ wscat -c  wss://api.hyperliquid.xyz/ws
Connected (press CTRL+C to quit)
>  { "method": "subscribe", "subscription": { "type": "trades", "coin": "SOL" } }
< {"channel":"subscriptionResponse","data":{"method":"subscribe","subscription":{"type":"trades","coin":"SOL"}}}
```

Important: all automated users should handle disconnects from the server side and gracefully reconnect. Disconnection from API servers may happen periodically and without announcement. Missed data during the reconnect will be present in the snapshot ack on reconnect. Users can also manually query any missed data using the corresponding info request.

Note: this doc uses Typescript for defining many of the message types. The python SDK also has examples [here](https://github.com/hyperliquid-dex/hyperliquid-python-sdk/blob/master/hyperliquid/utils/types.py) and example connection code [here](https://github.com/hyperliquid-dex/hyperliquid-python-sdk/blob/master/hyperliquid/websocket_manager.py).

```python

from __future__ import annotations

from typing import Any, Callable, Dict, List, Literal, NamedTuple, Optional, Tuple, TypedDict, Union, cast
from typing_extensions import NotRequired

Any = Any
Option = Optional
cast = cast
Callable = Callable
NamedTuple = NamedTuple
NotRequired = NotRequired

AssetInfo = TypedDict("AssetInfo", {"name": str, "szDecimals": int})
Meta = TypedDict("Meta", {"universe": List[AssetInfo]})
Side = Union[Literal["A"], Literal["B"]]
SIDES: List[Side] = ["A", "B"]

SpotAssetInfo = TypedDict("SpotAssetInfo", {"name": str, "tokens": List[int], "index": int, "isCanonical": bool})
SpotTokenInfo = TypedDict(
    "SpotTokenInfo",
    {
        "name": str,
        "szDecimals": int,
        "weiDecimals": int,
        "index": int,
        "tokenId": str,
        "isCanonical": bool,
        "evmContract": Optional[str],
        "fullName": Optional[str],
    },
)
SpotMeta = TypedDict("SpotMeta", {"universe": List[SpotAssetInfo], "tokens": List[SpotTokenInfo]})
SpotAssetCtx = TypedDict(
    "SpotAssetCtx",
    {"dayNtlVlm": str, "markPx": str, "midPx": Optional[str], "prevDayPx": str, "circulatingSupply": str, "coin": str},
)
SpotMetaAndAssetCtxs = Tuple[SpotMeta, List[SpotAssetCtx]]

AllMidsSubscription = TypedDict("AllMidsSubscription", {"type": Literal["allMids"]})
BboSubscription = TypedDict("BboSubscription", {"type": Literal["bbo"], "coin": str})
L2BookSubscription = TypedDict("L2BookSubscription", {"type": Literal["l2Book"], "coin": str})
TradesSubscription = TypedDict("TradesSubscription", {"type": Literal["trades"], "coin": str})
UserEventsSubscription = TypedDict("UserEventsSubscription", {"type": Literal["userEvents"], "user": str})
UserFillsSubscription = TypedDict("UserFillsSubscription", {"type": Literal["userFills"], "user": str})
CandleSubscription = TypedDict("CandleSubscription", {"type": Literal["candle"], "coin": str, "interval": str})
OrderUpdatesSubscription = TypedDict("OrderUpdatesSubscription", {"type": Literal["orderUpdates"], "user": str})
UserFundingsSubscription = TypedDict("UserFundingsSubscription", {"type": Literal["userFundings"], "user": str})
UserNonFundingLedgerUpdatesSubscription = TypedDict(
    "UserNonFundingLedgerUpdatesSubscription", {"type": Literal["userNonFundingLedgerUpdates"], "user": str}
)
WebData2Subscription = TypedDict("WebData2Subscription", {"type": Literal["webData2"], "user": str})
ActiveAssetCtxSubscription = TypedDict("ActiveAssetCtxSubscription", {"type": Literal["activeAssetCtx"], "coin": str})
ActiveAssetDataSubscription = TypedDict(
    "ActiveAssetDataSubscription", {"type": Literal["activeAssetData"], "user": str, "coin": str}
)
# If adding new subscription types that contain coin's don't forget to handle automatically rewrite name to coin in info.subscribe
Subscription = Union[
    AllMidsSubscription,
    BboSubscription,
    L2BookSubscription,
    TradesSubscription,
    UserEventsSubscription,
    UserFillsSubscription,
    CandleSubscription,
    OrderUpdatesSubscription,
    UserFundingsSubscription,
    UserNonFundingLedgerUpdatesSubscription,
    WebData2Subscription,
    ActiveAssetCtxSubscription,
    ActiveAssetDataSubscription,
]

AllMidsData = TypedDict("AllMidsData", {"mids": Dict[str, str]})
AllMidsMsg = TypedDict("AllMidsMsg", {"channel": Literal["allMids"], "data": AllMidsData})
L2Level = TypedDict("L2Level", {"px": str, "sz": str, "n": int})
L2BookData = TypedDict("L2BookData", {"coin": str, "levels": Tuple[List[L2Level], List[L2Level]], "time": int})
L2BookMsg = TypedDict("L2BookMsg", {"channel": Literal["l2Book"], "data": L2BookData})
BboData = TypedDict("BboData", {"coin": str, "time": int, "bbo": Tuple[Optional[L2Level], Optional[L2Level]]})
BboMsg = TypedDict("BboMsg", {"channel": Literal["bbo"], "data": BboData})
PongMsg = TypedDict("PongMsg", {"channel": Literal["pong"]})
Trade = TypedDict("Trade", {"coin": str, "side": Side, "px": str, "sz": int, "hash": str, "time": int})
CrossLeverage = TypedDict(
    "CrossLeverage",
    {
        "type": Literal["cross"],
        "value": int,
    },
)
IsolatedLeverage = TypedDict(
    "IsolatedLeverage",
    {
        "type": Literal["isolated"],
        "value": int,
        "rawUsd": str,
    },
)
Leverage = Union[CrossLeverage, IsolatedLeverage]
TradesMsg = TypedDict("TradesMsg", {"channel": Literal["trades"], "data": List[Trade]})
PerpAssetCtx = TypedDict(
    "PerpAssetCtx",
    {
        "funding": str,
        "openInterest": str,
        "prevDayPx": str,
        "dayNtlVlm": str,
        "premium": str,
        "oraclePx": str,
        "markPx": str,
        "midPx": Optional[str],
        "impactPxs": Optional[Tuple[str, str]],
        "dayBaseVlm": str,
    },
)
ActiveAssetCtx = TypedDict("ActiveAssetCtx", {"coin": str, "ctx": PerpAssetCtx})
ActiveSpotAssetCtx = TypedDict("ActiveSpotAssetCtx", {"coin": str, "ctx": SpotAssetCtx})
ActiveAssetCtxMsg = TypedDict("ActiveAssetCtxMsg", {"channel": Literal["activeAssetCtx"], "data": ActiveAssetCtx})
ActiveSpotAssetCtxMsg = TypedDict(
    "ActiveSpotAssetCtxMsg", {"channel": Literal["activeSpotAssetCtx"], "data": ActiveSpotAssetCtx}
)
ActiveAssetData = TypedDict(
    "ActiveAssetData",
    {
        "user": str,
        "coin": str,
        "leverage": Leverage,
        "maxTradeSzs": Tuple[str, str],
        "availableToTrade": Tuple[str, str],
        "markPx": str,
    },
)
ActiveAssetDataMsg = TypedDict("ActiveAssetDataMsg", {"channel": Literal["activeAssetData"], "data": ActiveAssetData})
Fill = TypedDict(
    "Fill",
    {
        "coin": str,
        "px": str,
        "sz": str,
        "side": Side,
        "time": int,
        "startPosition": str,
        "dir": str,
        "closedPnl": str,
        "hash": str,
        "oid": int,
        "crossed": bool,
        "fee": str,
        "tid": int,
        "feeToken": str,
    },
)
# TODO: handle other types of user events
UserEventsData = TypedDict("UserEventsData", {"fills": List[Fill]}, total=False)
UserEventsMsg = TypedDict("UserEventsMsg", {"channel": Literal["user"], "data": UserEventsData})
UserFillsData = TypedDict("UserFillsData", {"user": str, "isSnapshot": bool, "fills": List[Fill]})
UserFillsMsg = TypedDict("UserFillsMsg", {"channel": Literal["userFills"], "data": UserFillsData})
OtherWsMsg = TypedDict(
    "OtherWsMsg",
    {
        "channel": Union[
            Literal["candle"],
            Literal["orderUpdates"],
            Literal["userFundings"],
            Literal["userNonFundingLedgerUpdates"],
            Literal["webData2"],
        ],
        "data": Any,
    },
    total=False,
)
WsMsg = Union[
    AllMidsMsg,
    BboMsg,
    L2BookMsg,
    TradesMsg,
    UserEventsMsg,
    PongMsg,
    UserFillsMsg,
    OtherWsMsg,
    ActiveAssetCtxMsg,
    ActiveSpotAssetCtxMsg,
    ActiveAssetDataMsg,
]

# b is the public address of the builder, f is the amount of the fee in tenths of basis points. e.g. 10 means 1 basis point
BuilderInfo = TypedDict("BuilderInfo", {"b": str, "f": int})
Abstraction = Literal["unifiedAccount", "portfolioMargin", "disabled"]
AgentAbstraction = Literal["u", "p", "i"]

PerpDexSchemaInput = TypedDict(
    "PerpDexSchemaInput", {"fullName": str, "collateralToken": int, "oracleUpdater": Optional[str]}
)


class Cloid:
    def __init__(self, raw_cloid: str):
        self._raw_cloid: str = raw_cloid
        self._validate()

    def _validate(self):
        if not self._raw_cloid[:2] == "0x":
            raise TypeError("cloid is not a hex string")
        if not len(self._raw_cloid[2:]) == 32:
            raise TypeError("cloid is not 16 bytes")

    def __str__(self):
        return str(self._raw_cloid)

    def __repr__(self):
        return str(self._raw_cloid)

    @staticmethod
    def from_int(cloid: int) -> Cloid:
        return Cloid(f"{cloid:#034x}")

    @staticmethod
    def from_str(cloid: str) -> Cloid:
        return Cloid(cloid)

    def to_raw(self):
        return self._raw_cloid
```

```python
import json
import logging
import threading
from collections import defaultdict

import websocket

from hyperliquid.utils.types import Any, Callable, Dict, List, NamedTuple, Optional, Subscription, Tuple, WsMsg

ActiveSubscription = NamedTuple("ActiveSubscription", [("callback", Callable[[Any], None]), ("subscription_id", int)])


def subscription_to_identifier(subscription: Subscription) -> str:
    if subscription["type"] == "allMids":
        return "allMids"
    elif subscription["type"] == "l2Book":
        return f'l2Book:{subscription["coin"].lower()}'
    elif subscription["type"] == "trades":
        return f'trades:{subscription["coin"].lower()}'
    elif subscription["type"] == "userEvents":
        return "userEvents"
    elif subscription["type"] == "userFills":
        return f'userFills:{subscription["user"].lower()}'
    elif subscription["type"] == "candle":
        return f'candle:{subscription["coin"].lower()},{subscription["interval"]}'
    elif subscription["type"] == "orderUpdates":
        return "orderUpdates"
    elif subscription["type"] == "userFundings":
        return f'userFundings:{subscription["user"].lower()}'
    elif subscription["type"] == "userNonFundingLedgerUpdates":
        return f'userNonFundingLedgerUpdates:{subscription["user"].lower()}'
    elif subscription["type"] == "webData2":
        return f'webData2:{subscription["user"].lower()}'
    elif subscription["type"] == "bbo":
        return f'bbo:{subscription["coin"].lower()}'
    elif subscription["type"] == "activeAssetCtx":
        return f'activeAssetCtx:{subscription["coin"].lower()}'
    elif subscription["type"] == "activeAssetData":
        return f'activeAssetData:{subscription["coin"].lower()},{subscription["user"].lower()}'


def ws_msg_to_identifier(ws_msg: WsMsg) -> Optional[str]:
    if ws_msg["channel"] == "pong":
        return "pong"
    elif ws_msg["channel"] == "allMids":
        return "allMids"
    elif ws_msg["channel"] == "l2Book":
        return f'l2Book:{ws_msg["data"]["coin"].lower()}'
    elif ws_msg["channel"] == "trades":
        trades = ws_msg["data"]
        if len(trades) == 0:
            return None
        else:
            return f'trades:{trades[0]["coin"].lower()}'
    elif ws_msg["channel"] == "user":
        return "userEvents"
    elif ws_msg["channel"] == "userFills":
        return f'userFills:{ws_msg["data"]["user"].lower()}'
    elif ws_msg["channel"] == "candle":
        return f'candle:{ws_msg["data"]["s"].lower()},{ws_msg["data"]["i"]}'
    elif ws_msg["channel"] == "orderUpdates":
        return "orderUpdates"
    elif ws_msg["channel"] == "userFundings":
        return f'userFundings:{ws_msg["data"]["user"].lower()}'
    elif ws_msg["channel"] == "userNonFundingLedgerUpdates":
        return f'userNonFundingLedgerUpdates:{ws_msg["data"]["user"].lower()}'
    elif ws_msg["channel"] == "webData2":
        return f'webData2:{ws_msg["data"]["user"].lower()}'
    elif ws_msg["channel"] == "bbo":
        return f'bbo:{ws_msg["data"]["coin"].lower()}'
    elif ws_msg["channel"] == "activeAssetCtx" or ws_msg["channel"] == "activeSpotAssetCtx":
        return f'activeAssetCtx:{ws_msg["data"]["coin"].lower()}'
    elif ws_msg["channel"] == "activeAssetData":
        return f'activeAssetData:{ws_msg["data"]["coin"].lower()},{ws_msg["data"]["user"].lower()}'


class WebsocketManager(threading.Thread):
    def __init__(self, base_url):
        super().__init__()
        self.subscription_id_counter = 0
        self.ws_ready = False
        self.queued_subscriptions: List[Tuple[Subscription, ActiveSubscription]] = []
        self.active_subscriptions: Dict[str, List[ActiveSubscription]] = defaultdict(list)
        ws_url = "ws" + base_url[len("http") :] + "/ws"
        self.ws = websocket.WebSocketApp(ws_url, on_message=self.on_message, on_open=self.on_open)
        self.ping_sender = threading.Thread(target=self.send_ping)
        self.stop_event = threading.Event()

    def run(self):
        self.ping_sender.start()
        self.ws.run_forever()

    def send_ping(self):
        while not self.stop_event.wait(50):
            if not self.ws.keep_running:
                break
            logging.debug("Websocket sending ping")
            self.ws.send(json.dumps({"method": "ping"}))
        logging.debug("Websocket ping sender stopped")

    def stop(self):
        self.stop_event.set()
        self.ws.close()
        if self.ping_sender.is_alive():
            self.ping_sender.join()

    def on_message(self, _ws, message):
        if message == "Websocket connection established.":
            logging.debug(message)
            return
        logging.debug(f"on_message {message}")
        ws_msg: WsMsg = json.loads(message)
        identifier = ws_msg_to_identifier(ws_msg)
        if identifier == "pong":
            logging.debug("Websocket received pong")
            return
        if identifier is None:
            logging.debug("Websocket not handling empty message")
            return
        active_subscriptions = self.active_subscriptions[identifier]
        if len(active_subscriptions) == 0:
            print("Websocket message from an unexpected subscription:", message, identifier)
        else:
            for active_subscription in active_subscriptions:
                active_subscription.callback(ws_msg)

    def on_open(self, _ws):
        logging.debug("on_open")
        self.ws_ready = True
        for subscription, active_subscription in self.queued_subscriptions:
            self.subscribe(subscription, active_subscription.callback, active_subscription.subscription_id)

    def subscribe(
        self, subscription: Subscription, callback: Callable[[Any], None], subscription_id: Optional[int] = None
    ) -> int:
        if subscription_id is None:
            self.subscription_id_counter += 1
            subscription_id = self.subscription_id_counter
        if not self.ws_ready:
            logging.debug("enqueueing subscription")
            self.queued_subscriptions.append((subscription, ActiveSubscription(callback, subscription_id)))
        else:
            logging.debug("subscribing")
            identifier = subscription_to_identifier(subscription)
            if identifier == "userEvents" or identifier == "orderUpdates":
                # TODO: ideally the userEvent and orderUpdates messages would include the user so that we can multiplex
                if len(self.active_subscriptions[identifier]) != 0:
                    raise NotImplementedError(f"Cannot subscribe to {identifier} multiple times")
            self.active_subscriptions[identifier].append(ActiveSubscription(callback, subscription_id))
            self.ws.send(json.dumps({"method": "subscribe", "subscription": subscription}))
        return subscription_id

    def unsubscribe(self, subscription: Subscription, subscription_id: int) -> bool:
        if not self.ws_ready:
            raise NotImplementedError("Can't unsubscribe before websocket connected")
        identifier = subscription_to_identifier(subscription)
        active_subscriptions = self.active_subscriptions[identifier]
        new_active_subscriptions = [x for x in active_subscriptions if x.subscription_id != subscription_id]
        if len(new_active_subscriptions) == 0:
            self.ws.send(json.dumps({"method": "unsubscribe", "subscription": subscription}))
        self.active_subscriptions[identifier] = new_active_subscriptions
        return len(active_subscriptions) != len(new_active_subscriptions)
```
