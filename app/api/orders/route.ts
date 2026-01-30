import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { sendOrderConfirmationEmail } from "@/lib/email";

export async function POST(req: Request) {
    try {
        type OrderItemInput = { id: string; quantity: number; price: number; title?: string; name?: string };
        type CustomerInput = { email?: string; firstName?: string } | null;
        const body = await req.json() as { items: OrderItemInput[]; total: number; customer: CustomerInput };
        const { items, total, customer } = body;

        const order = await prisma.order.create({
            data: {
                total,
                customer: JSON.stringify(customer),
                status: "PAID",
                items: {
                    create: items.map((item) => ({
                        product: { connect: { id: item.id } },
                        quantity: item.quantity,
                        price: item.price
                    }))
                }
            },
            include: { items: { include: { product: true } } }
        });

        if (customer?.email) {
            const emailItems = items.map((item) => ({
                name: item.title || item.name || "Product",
                quantity: item.quantity,
                price: item.price
            }));

            await sendOrderConfirmationEmail(customer.email, {
                id: order.id,
                total: order.total,
                customerName: customer.firstName || "Customer",
                items: emailItems
            });
        }

        return NextResponse.json(order);
    } catch (error) {
        console.error("Order creation failed FULL ERROR:", error);
        return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const email = searchParams.get('email');

        if (!email) {
            return NextResponse.json({ error: "Email required" }, { status: 400 });
        }

        // In a real app we'd query by relations, but we stored customer as JSON string
        // So we have to fetch all and filter or rely on a proper relation migration later.
        // For this MVP, let's assume we can filter roughly or fetch all recent.
        // Actually, since customer is a JSON string, filtering in Prisma is hard with sqlite.
        // Better: Fetch all orders and filter in JS (inefficient but works for small scale MVP)

        const orders = await prisma.order.findMany({
            include: { items: { include: { product: true } } },
            orderBy: { createdAt: 'desc' }
        });

        const userOrders = orders.filter(order => {
            try {
                const customer = JSON.parse(order.customer as string);
                return customer.email === email;
            } catch {
                return false;
            }
        });

        return NextResponse.json(userOrders);
    } catch (error) {
        console.error("Failed to fetch orders:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
