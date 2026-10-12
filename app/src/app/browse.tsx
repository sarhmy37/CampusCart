import { Redirect, useLocalSearchParams } from 'expo-router';

export default function BrowseRedirect() {
  const params = useLocalSearchParams();
  return <Redirect href={{ pathname: '/(browse)/all', params }} />;
}