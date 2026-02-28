import { Redirect } from 'expo-router';

export default function Index() {
    // Direct users to the premium host login screen first
    return <Redirect href="/(auth)" />;
}
