import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, created, ok, rateLimit, requireAdmin } from "@/lib/api";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
        const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize') || '20')));
        const skip = (page - 1) * pageSize;
        const order = (url.searchParams.get('order') || 'desc') as 'asc' | 'desc';
        const category = url.searchParams.get('category') || undefined;
        const team = url.searchParams.get('team') || undefined;
        const featured = url.searchParams.get('featured');

        const where: {
            category?: string;
            team?: string;
            featured?: boolean;
        } = {};
        if (category) where.category = category;
        if (team) where.team = team;
        if (featured === 'true') where.featured = true;

        const [items, total] = await Promise.all([
            prisma.product.findMany({ where, orderBy: { createdAt: order }, skip, take: pageSize }),
            prisma.product.count({ where }),
        ]);

        return ok({ items, total, page, pageSize });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const ip = req.headers.get('x-forwarded-for') || 'local';
        const rl = rateLimit(`products:create:${ip}`, 10, 60_000);
        if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

        const guard = await requireAdmin(req);
        if (guard) return guard;

        const body = await req.json();

        if (!body?.name || typeof body.name !== 'string' || body.name.trim() === "") {
            return badRequest("Product name is required");
        }

        const priceNum = Number(body.price);
        if (!Number.isFinite(priceNum)) {
            return badRequest("Price must be a valid number");
        }

        const stockNum = Number(body.stock ?? 10);
        if (!Number.isInteger(stockNum) || stockNum < 0) {
            return badRequest("Stock must be a non-negative integer");
        }

        const product = await prisma.product.create({
            data: {
                productNumber: String(body.productNumber ?? ""),
                name: body.name.trim(),
                price: priceNum,
                description: String(body.description ?? ""),
                image: String(body.image ?? ""),
                category: String(body.category ?? "General"),
                team: String(body.team ?? ""),
                sizes: String(body.sizes ?? "S,M,L,XL,2XL"),
                stock: stockNum,
                featured: Boolean(body.featured ?? false),
            },
        });
        return created(product);
    } catch (error) {
        console.error("Error creating product:", error);
        return NextResponse.json({
            error: "Failed to create product"
        }, { status: 500 });
    }
}
