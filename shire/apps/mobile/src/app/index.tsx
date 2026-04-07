import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/features/auth';
import { useTheme } from '@/theme';

export default function Index() {
    const { colors } = useTheme();
    const { isInitializing, isAuthenticated, currentLocation } = useAuth();

    if (isInitializing) {
        return (
            <View
                style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.background,
                }}
            >
                <ActivityIndicator color={colors.accent} />
            </View>
        );
    }

    if (!isAuthenticated) {
        return <Redirect href="/(auth)" />;
    }

    if (!currentLocation) {
        return <Redirect href="/(auth)/location" />;
    }

    return <Redirect href="/(host)" />;
}
