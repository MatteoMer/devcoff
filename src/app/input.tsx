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
    const [isInviting, setIsInviting] = useState(false);
    const [telegramLink, setTelegramLink] = useState('');
    const [zupassLink, setZupassLink] = useState('');



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
                setEmailContent(`generating proof, time remaning: ${Math.floor(proof.estimatedTimeLeft / 60)}:${Math.floor(proof.estimatedTimeLeft % 60).toString().padStart(2, '0')}`);
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
                                email,
                                isInviting
                            }),
                        });
                        console.log(name, email)
                        const data = await res.json()
                        if (!data.existingTicket) {
                            if (isInviting) { setEmailContent(`Your ticket for ${name}has been generated. Can be claimed at this url by your friend! ${data.url}`) } else {
                                openZupassPopupUrl(data.url)
                            }
                            setEmailContent("generated ticket")
                            setTelegramLink(data.tgLink)
                            setZupassLink(data.url)
                        } else {
                            setEmailContent("ticket already been generated before. if you lost it, contact @Matteo_Mer or @s0lness on tg")
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
                        Invite someone else
                        <input
                            type="checkbox"
                            checked={isInviting}
                            onChange={(e) => setIsInviting(e.target.checked)}
                            disabled={isDisabled}
                        />
                    </label>
                </div>
                <div>
                    <label>
                        {isInviting ? "Invitee's name:" : "Your name:"}

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
                        {isInviting ? "Invitee's email:" : "Your email:"}
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
                    <p>Upload your Devcon rejection email (<a href="https://help.salesforce.com/s/articleView?id=000389554&type=1" target="_blank">.eml file</a>):</p>
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

            {zupassLink && (
                <p>
                    If the popup did not open, you can add the ticket on zupass <a target="_blank" href={zupassLink}>here</a>
                </p>
            )}
            {telegramLink && (
                <p> Join the telegram of the group <a target="_blank" href={telegramLink}>here</a> </p>
            )}
            <p>
                contact @Matteo_Mer or @s0lness on tg for any questions or bug!
            </p>
        </div>)
}
