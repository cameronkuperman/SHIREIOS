// Mock react-native-mmkv
jest.mock('react-native-mmkv', () => {
  const store = new Map<string, string>();
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      getString: jest.fn((key: string) => store.get(key)),
      set: jest.fn((key: string, value: string) => store.set(key, value)),
      delete: jest.fn((key: string) => store.delete(key)),
      contains: jest.fn((key: string) => store.has(key)),
      getAllKeys: jest.fn(() => [...store.keys()]),
      clearAll: jest.fn(() => store.clear()),
    })),
  };
});

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
  }),
}));
