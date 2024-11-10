import { Entity, PrimaryColumn, CreateDateColumn, Column } from "typeorm"

@Entity()
export class User {
    @PrimaryColumn()
    telegramId!: number;

    @CreateDateColumn()
    registeredAt!: Date;

    constructor(data?: Partial<User>) {
        if (data) {
            Object.assign(this, data);
        }
    }
}
