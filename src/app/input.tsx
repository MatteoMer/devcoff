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
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [isFormValid, setIsFormValid] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [isDisabled, setIsDisabled] = useState(false);


    useEffect(() => {
        createInputWorker("saugardev/devcon-rejection-proof")
    }, [])

    useEffect(() => {
        // Validate form whenever name or email changes
        setIsFormValid(name.trim() !== '' && email.includes('@'));
    }, [name, email]);


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
                            body: JSON.stringify({
                                proof,
                                name,
                                email
                            }),
                        });
                        console.log(name, email)
                        const data = await res.json()
                        if (!data.existingTicket) {
                            openZupassPopupUrl(data.url)
                            setEmailContent("generated ticket")
                        } else {
                            setEmailContent("ticket already been generated before. if you lost it, contact @Matteo_Mer on tg")
                        }
                    }
                    setIsDisabled(false)

                    verifyAndGenerateTicket()


                } else {
                    setIsDisabled(true)
                }
            }
        }
    }, [proofStatus])

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault()
        if (!isFormValid) {
            setEmailContent('Please fill in all required fields');
            return;
        }
        if (!file) {
            setEmailContent('Please select a file');
            return;
        }


        setExternalInputs({})

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

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
        }
    };


    return (
        <div>
            <h1>Devcoff</h1>
            <p>Got rejected for a talk at Devcon? join us for a side-event!</p>
            <p>Using <a href="https://prove.email">zk-email</a> we can easily prove that someone got rejected from Devcon. From there we generate a zupass ticket! And then we have fun!</p>

            <form onSubmit={handleSubmit}>
                <div>
                    <label>
                        Name:
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            disabled={isDisabled}
                        />
                    </label>
                </div>

                <div>
                    <label>
                        Email:
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={isDisabled}
                        />
                    </label>
                </div>

                <div>
                    <p>Upload your Devcon rejection email (.eml file):</p>
                    <input
                        type="file"
                        accept=".eml"
                        onChange={handleFileChange}
                        disabled={isDisabled}
                    />
                </div>

                <button
                    type="submit"
                    disabled={isDisabled}
                >Submit</button>
            </form>

            {emailContent && (
                <p>
                    {emailContent}
                </p>
            )}
        </div>)
}
