import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, notFound, ok, requireAdmin } from "@/lib/api";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const { id } = params;
        if (!id) return badRequest('Missing id');
        const product = await prisma.product.findUnique({ where: { id } });
        if (!product) return notFound("Product not found");
        return ok(product);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = await requireAdmin(req);
        if (guard) return guard;
        const { id } = params;
        const body = await req.json();

        const price = Number(body.price);
        const stock = Number(body.stock);
        if (!Number.isFinite(price) || !Number.isInteger(stock) || stock < 0) {
            return badRequest('Invalid price or stock');
        }

        const product = await prisma.product.update({
            where: { id },
            data: {
                productNumber: String(body.productNumber ?? ''),
                name: String(body.name ?? ''),
                price,
                description: String(body.description ?? ''),
                image: String(body.image ?? ''),
                category: String(body.category ?? ''),
                team: String(body.team ?? ''),
                stock,
                sizes: String(body.sizes ?? ''),
                featured: Boolean(body.featured ?? false),
            },
        });
        return ok(product);
    } catch (error) {
        console.error("Update error:", error);
        return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = await requireAdmin(req);
        if (guard) return guard;
        const { id } = params;

        await prisma.orderItem.deleteMany({ where: { productId: id } });
        await prisma.product.delete({ where: { id } });
        return ok({ success: true });
    } catch (error) {
        console.error("Delete error:", error);
        return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
    }
}
