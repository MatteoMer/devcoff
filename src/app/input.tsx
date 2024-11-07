'use client'

import { ScriptProps } from "next/script";
import { useState, FormEvent, ChangeEvent, useEffect } from 'react';
import { useZkEmailSDK } from "@zk-email/zk-email-sdk";
import { openZupassPopupUrl } from "@pcd/passport-interface";


export default function InputPage(props: ScriptProps) {

    const [emailContent, setEmailContent] = useState('');
    const {
        createInputWorker,
        generateInputFromEmail,
        generateProofRemotely,
        proofStatus,
        inputWorkers
    } = useZkEmailSDK();
    const [externalInputs, setExternalInputs] = useState<Record<string, string>>({});

    useEffect(() => {

        createInputWorker("saugardev/devcon-rejection-proof")
    }, [])


    useEffect(() => {
        if (Object.keys(proofStatus).length > 0) {
            for (const [key, proof] of Object.entries(proofStatus)) {
                console.log(proof.status, proof.estimatedTimeLeft / 60)
                setEmailContent(`generating proof, time remaning: ${proof.estimatedTimeLeft / 60}`);
                if (proof.status == 'COMPLETED') {
                    setEmailContent("proof computed: generating ticket")
                    const verifyAndGenerateTicket = async () => {
                        const res = await fetch('/api/ticket', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ proof }),
                        });
                        const data = await res.json()
                        openZupassPopupUrl(data.url)
                        setEmailContent("generated ticket")
                    }

                    verifyAndGenerateTicket()


                }
            }
        }
    }, [proofStatus])

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        setExternalInputs({})
        const file = event.target.files?.[0];
        if (!file) return;
        setEmailContent('');

        try {
            const text = await file.text();
            const input = await generateInputFromEmail(
                "saugardev/devcon-rejection-proof",
                text,
                externalInputs
            )

            console.log(input);
            const proofRes = await generateProofRemotely(
                "saugardev/devcon-rejection-proof",
                input
            )
            console.log("proofRes", proofRes);
        } catch (error) {
            console.log(error)
        }
    };


    return (
        <div>
            <h1>Devcoff</h1>
            <p>Got rejected for a talk at Devcon? join us for a side-event!</p>
            <p>Using <a href="https://prove.email">zk-email</a> we can easily prove that someone got rejected from Devcon. From there we generate a zupass ticket! And then we have fun!</p>

            <div>
                <p>Upload your Devcon rejection email (.eml file):</p>
                <input
                    type="file"
                    accept=".eml"
                    onChange={handleFileChange}
                />
            </div>

            {emailContent && (
                <p style={{ marginTop: '1rem' }}>
                    {emailContent}
                </p>
            )}
        </div >
    )
}