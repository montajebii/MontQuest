// Several react-native exports are lazy getters on the main module.
// Plain assignment (`RN.X = ...`) silently does nothing because the
// property has only a getter and no setter. We must use defineProperty.
// We override each getter that React Navigation v7 relies on and that
// lacks addEventListener in RN 0.76's jest preset.

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');

  const makeSubscription = handler => ({
    remove: () => handler && handler(),
  });

  const makeEventEmitter = () => {
    const listeners = new Set();
    const addEventListener = jest.fn((_event, handler) => {
      listeners.add(handler);
      return {
        remove: () => listeners.delete(handler),
      };
    });
    const removeEventListener = jest.fn((_event, handler) => {
      listeners.delete(handler);
    });
    return {
      __esModule: true,
      default: {
        addEventListener,
        removeEventListener,
        listeners,
      },
      addEventListener,
      removeEventListener,
      listeners,
    };
  };

  const override = (name, value) => {
    Object.defineProperty(RN, name, {
      configurable: true,
      enumerable: true,
      get: () => value,
    });
  };

  // BackHandler
  const backHandlers = new Set();
  const exitApp = jest.fn();
  const backHandlerObj = {
    addEventListener: jest.fn((_event, handler) => {
      backHandlers.add(handler);
      return { remove: () => backHandlers.delete(handler) };
    }),
    removeEventListener: jest.fn((_event, handler) => {
      backHandlers.delete(handler);
    }),
    exitApp,
    mockPressBack: () => {
      let invokeDefault = true;
      for (const handler of [...backHandlers].reverse()) {
        if (handler()) {
          invokeDefault = false;
          break;
        }
      }
      if (invokeDefault) {
        exitApp();
      }
    },
  };
  override('BackHandler', {
    __esModule: true,
    ...backHandlerObj,
    default: backHandlerObj,
  });

  // Linking
  const linkingObj = {
    ...makeEventEmitter(),
    openURL: jest.fn(() => Promise.resolve()),
    canOpenURL: jest.fn(() => Promise.resolve(true)),
    openSettings: jest.fn(() => Promise.resolve()),
    getInitialURL: jest.fn(() => Promise.resolve(null)),
    sendIntent: jest.fn(() => Promise.resolve()),
  };
  linkingObj.default = linkingObj;
  linkingObj.__esModule = true;
  override('Linking', linkingObj);

  // AppState
  const appStateObj = {
    ...makeEventEmitter(),
    currentState: 'active',
    isAvailable: true,
  };
  appStateObj.default = appStateObj;
  appStateObj.__esModule = true;
  override('AppState', appStateObj);

  // Avoid unused-warning
  makeSubscription;

  return RN;
});

jest.mock('react-native-background-geolocation', () => {
  const noop = jest.fn();
  const api = {
    ready: jest.fn(() => Promise.resolve({ enabled: true })),
    onGeofence: jest.fn(() => ({ remove: noop })),
    addGeofences: jest.fn(() => Promise.resolve()),
    addGeofence: jest.fn(() => Promise.resolve()),
    removeGeofences: jest.fn(() => Promise.resolve()),
    removeGeofence: jest.fn(() => Promise.resolve()),
    getState: jest.fn(() => Promise.resolve({ enabled: true })),
    getProviderState: jest.fn(() =>
      Promise.resolve({
        enabled: true,
        status: 3,
        network: true,
        gps: true,
        accuracyAuthorization: 0,
      })
    ),
    getCurrentPosition: jest.fn(() =>
      Promise.resolve({ coords: { latitude: 35.6892, longitude: 51.389 } })
    ),
    requestPermission: jest.fn(() => Promise.resolve(3)),
    stop: jest.fn(() => Promise.resolve()),
    start: jest.fn(() => Promise.resolve()),
    DesiredAccuracy: { High: 0, Medium: 10, Low: 100, Navigation: -1 },
    LogLevel: { Off: 0, Error: 1, Warning: 2, Info: 3, Debug: 4, Verbose: 5 },
    AuthorizationStatus: {
      NotDetermined: 0, Restricted: 1, Denied: 2, Always: 3,
      WhenInUse: 4, DeniedAlways: 5,
    },
  };
  return { __esModule: true, default: api, ...api };
});

jest.mock('@notifee/react-native', () => {
  const api = {
    requestPermission: jest.fn(() => Promise.resolve({ authorizationStatus: 1 })),
    createChannel: jest.fn(() => Promise.resolve('nearby')),
    displayNotification: jest.fn(() => Promise.resolve('id')),
    onForegroundEvent: jest.fn(() => jest.fn()),
    onBackgroundEvent: jest.fn(() => Promise.resolve()),
    getInitialNotification: jest.fn(() => Promise.resolve(null)),
    AndroidImportance: {
      NONE: 0,
      MIN: 1,
      LOW: 2,
      DEFAULT: 3,
      HIGH: 4,
      MAX: 5,
    },
    EventType: {
      DISMISSED: 0,
      PRESS: 1,
      PRESS_ACTION: 2,
      DELIVERED: 3,
      APP_BLOCKED: 4,
      CHANNEL_BLOCKED: 5,
      ERROR: 6,
    },
  };
  return { __esModule: true, default: api, ...api };
});

jest.mock('@maplibre/maplibre-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  // Render every MapLibre component as a plain View so children still render.
  const make = props => React.createElement(View, props, props.children);
  const MapLibreRN = {
    MapView: make,
    Camera: make,
    PointAnnotation: make,
    Callout: make,
    ShapeSource: make,
    CircleLayer: make,
    FillLayer: make,
    LineLayer: make,
    SymbolLayer: make,
    BackgroundLayer: make,
    Images: make,
    UserLocation: make,
    UserLocationRenderMode: { Native: 'native', Normal: 'normal' },
    UserTrackingMode: { Follow: 'normal', Compass: 'compass' },
  };
  return { __esModule: true, default: MapLibreRN, ...MapLibreRN };
});

jest.mock('react-native-sqlite-storage', () => {
  const makeDb = () => ({
    executeSql: jest.fn(() =>
      Promise.resolve([{
        rows: { length: 0, item: () => null, raw: () => [] },
        rowsAffected: 0,
        insertId: 0,
      }])
    ),
    close: jest.fn(),
  });
  const SQLite = {
    DEBUG: jest.fn(),
    enablePromise: jest.fn(),
    openDatabase: jest.fn(() => Promise.resolve(makeDb())),
    deleteDatabase: jest.fn(() => Promise.resolve()),
  };
  return { __esModule: true, default: SQLite, ...SQLite };
});


