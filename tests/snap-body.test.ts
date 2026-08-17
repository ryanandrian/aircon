import { describe, it, expect } from "vitest";
import { buildSnapBody } from "../src/lib/billing/midtrans-client";

describe("buildSnapBody — customer/item/shipping tidak boleh kosong", () => {
  it("langganan: customer lengkap + item berbaris (tanpa shipping)", () => {
    const body = buildSnapBody({
      orderId: "AIRCON-X",
      amount: 165390,
      customer: { firstName: "Ryan", lastName: "Diputra", email: "r@x.com", phone: "081234567890" },
      items: [
        { id: "plan-PROFESSIONAL", name: "Langganan Professional (1 bln)", price: 149000, quantity: 1, category: "subscription" },
        { id: "tax", name: "Pajak 11%", price: 16390, quantity: 1, category: "tax" },
      ],
    }) as any;

    expect(body.customer_details.first_name).toBe("Ryan");
    expect(body.customer_details.last_name).toBe("Diputra");
    expect(body.customer_details.email).toBe("r@x.com");
    expect(body.customer_details.phone).toBe("081234567890");
    expect(body.item_details).toHaveLength(2);
    expect(body.item_details[0].name).toBe("Langganan Professional (1 bln)");
    // jumlah item = gross_amount (transparan)
    const sum = body.item_details.reduce((s: number, it: any) => s + it.price * it.quantity, 0);
    expect(sum).toBe(body.transaction_details.gross_amount);
    // langganan tak punya shipping
    expect(body.customer_details.shipping_address).toBeUndefined();
  });

  it("perangkat IoT: shipping + billing terisi", () => {
    const body = buildSnapBody({
      orderId: "AIRCON-Y",
      amount: 832500,
      customer: { firstName: "Ryan", email: "r@x.com", phone: "0812" },
      items: [
        { id: "device", name: "Aircon Smart HVAC Device V1", price: 750000, quantity: 1, category: "iot_device" },
        { id: "tax", name: "Pajak 11%", price: 82500, quantity: 1, category: "tax" },
      ],
      shipping: { address: "Jl. Merdeka 10", city: "Bandung", postalCode: "40111", phone: "0812" },
    }) as any;

    expect(body.customer_details.shipping_address.address).toBe("Jl. Merdeka 10");
    expect(body.customer_details.shipping_address.city).toBe("Bandung");
    expect(body.customer_details.shipping_address.postal_code).toBe("40111");
    expect(body.customer_details.shipping_address.country_code).toBe("IDN");
    expect(body.customer_details.billing_address.address).toBe("Jl. Merdeka 10");
  });

  it("memotong batas Midtrans (nama customer 20, item 50)", () => {
    const body = buildSnapBody({
      orderId: "AIRCON-Z",
      amount: 1000,
      customer: { firstName: "A".repeat(40) },
      items: [{ id: "x", name: "N".repeat(80), price: 1000, quantity: 1 }],
    }) as any;
    expect((body.customer_details.first_name as string).length).toBe(20);
    expect((body.item_details[0].name as string).length).toBe(50);
  });

  it("fallback nama kosong -> 'Pelanggan'", () => {
    const body = buildSnapBody({
      orderId: "AIRCON-W", amount: 1000,
      customer: { firstName: "" }, items: [{ id: "x", name: "Item", price: 1000, quantity: 1 }],
    }) as any;
    expect(body.customer_details.first_name).toBe("Pelanggan");
  });
});
