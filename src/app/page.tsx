'use client'

import dynamic from 'next/dynamic';
import InputPage from './input';


const ZkEmailSDKProvider = dynamic(
    () => import('@zk-email/zk-email-sdk').then(mod => mod.ZkEmailSDKProvider),
    { ssr: false }
);

export default function Home() {

    let clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""

    return (
        // TODO: DONT COMMIT THIS
        <ZkEmailSDKProvider clientId={clientId} zkEmailSDKRegistryUrl="https://registry-dev.zkregex.com" >
            <InputPage />
        </ZkEmailSDKProvider >

    );
}
