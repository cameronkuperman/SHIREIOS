import { useWindowDimensions } from 'react-native';

export type AdaptiveLayout = 'split' | 'stack';

export function useAdaptiveLayout(breakpoint = 900): AdaptiveLayout {
  const { width } = useWindowDimensions();
  return width >= breakpoint ? 'split' : 'stack';
}
