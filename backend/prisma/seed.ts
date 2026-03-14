// prisma/seed.ts
import {
  PrismaClient, Role, OperationStatus, OperationType,
  MovementType, POStatus, SOStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding CoreInventory database...');

  // ── Users ──────────────────────────────────────────────────────────────────
  const hashedAdmin = await bcrypt.hash('Admin@123', 12);
  const hashedStaff = await bcrypt.hash('Staff@123', 12);

  const admin = await prisma.user.upsert({
    where:  { email: 'admin@coreinventory.com' },
    update: {},
    create: { email: 'admin@coreinventory.com', password: hashedAdmin, name: 'James Moore', role: Role.ADMIN },
  });

  const staff = await prisma.user.upsert({
    where:  { email: 'sarah@coreinventory.com' },
    update: {},
    create: { email: 'sarah@coreinventory.com', password: hashedStaff, name: 'Sarah Kim', role: Role.STAFF },
  });

  console.log('  ✓ Users');

  // ── Categories (sequential to avoid prepared statement conflicts) ───────────
  const rawMat     = await prisma.category.upsert({ where: { name: 'Raw Materials'     }, update: {}, create: { name: 'Raw Materials'     } });
  const finished   = await prisma.category.upsert({ where: { name: 'Finished Goods'    }, update: {}, create: { name: 'Finished Goods'    } });
  const consumables= await prisma.category.upsert({ where: { name: 'Consumables'       }, update: {}, create: { name: 'Consumables'       } });
  const tools      = await prisma.category.upsert({ where: { name: 'Tools & Equipment' }, update: {}, create: { name: 'Tools & Equipment' } });

  console.log('  ✓ Categories');

  // ── Warehouses ──────────────────────────────────────────────────────────────
  const mainWH    = await prisma.warehouse.create({ data: { name: 'Main Warehouse',   address: '10 Industrial Ave',         capacity: 10000 } });
  const prodFloor = await prisma.warehouse.create({ data: { name: 'Production Floor', address: '10 Industrial Ave (Wing B)', capacity: 5000  } });

  console.log('  ✓ Warehouses');

  // ── Locations (sequential) ─────────────────────────────────────────────────
  const zoneA    = await prisma.location.create({ data: { name: 'Zone A — Raw Materials',  warehouseId: mainWH.id    } });
  const zoneB    = await prisma.location.create({ data: { name: 'Zone B — Finished Goods', warehouseId: mainWH.id    } });
  const prodRack = await prisma.location.create({ data: { name: 'Production Rack',         warehouseId: prodFloor.id } });
  const dispatch = await prisma.location.create({ data: { name: 'Dispatch Zone',           warehouseId: mainWH.id    } });

  console.log('  ✓ Locations');

  // ── Products (sequential) ──────────────────────────────────────────────────
  const steelRods  = await prisma.product.create({ data: { name: 'Steel Rods 8mm',    sku: 'SKU-0041', categoryId: rawMat.id,       unit: 'kg',  reorderPoint: 100 } });
  const alSheets   = await prisma.product.create({ data: { name: 'Aluminum Sheets',   sku: 'SKU-0089', categoryId: rawMat.id,       unit: 'pcs', reorderPoint: 50  } });
  const hydraulic  = await prisma.product.create({ data: { name: 'Hydraulic Fluid',   sku: 'SKU-0203', categoryId: consumables.id,  unit: 'L',   reorderPoint: 20  } });
  const copperWire = await prisma.product.create({ data: { name: 'Copper Wire 2.5mm', sku: 'SKU-0317', categoryId: rawMat.id,       unit: 'm',   reorderPoint: 200 } });
  const gloves     = await prisma.product.create({ data: { name: 'Safety Gloves L',   sku: 'SKU-0445', categoryId: consumables.id,  unit: 'pcs', reorderPoint: 30  } });
  const bearings   = await prisma.product.create({ data: { name: 'Bearing 6205',      sku: 'SKU-0512', categoryId: tools.id,        unit: 'pcs', reorderPoint: 100 } });
  const chairs     = await prisma.product.create({ data: { name: 'Chairs Type A',     sku: 'SKU-0601', categoryId: finished.id,     unit: 'pcs', reorderPoint: 50  } });
  const steelRods6 = await prisma.product.create({ data: { name: 'Steel Rods 6mm',    sku: 'SKU-0712', categoryId: rawMat.id,       unit: 'kg',  reorderPoint: 200 } });

  console.log('  ✓ Products');

  // ── Stock Items (sequential) ───────────────────────────────────────────────
  const stockData = [
    { productId: steelRods.id,  locationId: zoneA.id, quantity: 0   },
    { productId: alSheets.id,   locationId: zoneA.id, quantity: 12  },
    { productId: hydraulic.id,  locationId: zoneA.id, quantity: 8   },
    { productId: copperWire.id, locationId: zoneA.id, quantity: 0   },
    { productId: gloves.id,     locationId: zoneA.id, quantity: 6   },
    { productId: bearings.id,   locationId: zoneA.id, quantity: 248 },
    { productId: chairs.id,     locationId: zoneB.id, quantity: 340 },
    { productId: steelRods6.id, locationId: zoneA.id, quantity: 850 },
  ];
  for (const s of stockData) {
    const status = s.quantity === 0 ? 'OUT' : s.quantity < 20 ? 'LOW' : 'OK';
    await prisma.stockItem.create({ data: { ...s, status } });
  }

  console.log('  ✓ Stock items');

  // ── Suppliers (sequential) ─────────────────────────────────────────────────
  const acme        = await prisma.supplier.create({ data: { name: 'AcmeCorp',       email: 'orders@acmecorp.com',    phone: '+1-555-0100' } });
  const metalSupply = await prisma.supplier.create({ data: { name: 'MetalSupply Ltd', email: 'sales@metalsupply.com', phone: '+1-555-0200' } });
  const globalParts = await prisma.supplier.create({ data: { name: 'GlobalParts Inc', email: 'supply@globalparts.com',phone: '+1-555-0300' } });

  console.log('  ✓ Suppliers');

  // ── Customers (sequential) ─────────────────────────────────────────────────
  const johnSmith  = await prisma.customer.create({ data: { name: 'John Smith',  email: 'john@example.com',   phone: '+1-555-1001' } });
  const janeLee    = await prisma.customer.create({ data: { name: 'Jane Lee',    email: 'jane@example.com',   phone: '+1-555-1002' } });
  const acmeRetail = await prisma.customer.create({ data: { name: 'Acme Retail', email: 'buy@acmeretail.com', phone: '+1-555-1003' } });
  const blueMart   = await prisma.customer.create({ data: { name: 'Blue Mart',   email: 'orders@bluemart.com'                      } });

  console.log('  ✓ Customers');

  // ── Internal Operations (sequential) ──────────────────────────────────────
  await prisma.operation.create({
    data: {
      reference: 'REC-0291', type: OperationType.RECEIPT, status: OperationStatus.READY,
      userId: admin.id, supplierId: acme.id, toLocationId: zoneA.id,
      lines: { create: [{ productId: steelRods.id, quantity: 200 }, { productId: alSheets.id, quantity: 80 }] },
    },
  });

  await prisma.operation.create({
    data: {
      reference: 'TRF-0103', type: OperationType.TRANSFER, status: OperationStatus.DONE,
      userId: admin.id, fromLocationId: zoneA.id, toLocationId: prodRack.id,
      completedAt: new Date(),
      lines: { create: [{ productId: bearings.id, quantity: 150 }] },
    },
  });

  await prisma.operation.create({
    data: {
      reference: 'ADJ-0067', type: OperationType.ADJUSTMENT, status: OperationStatus.DONE,
      userId: admin.id, toLocationId: zoneA.id, completedAt: new Date(),
      lines: { create: [{ productId: hydraulic.id, quantity: 3 }] },
    },
  });

  console.log('  ✓ Operations');

  // ── Purchase Orders (sequential) ──────────────────────────────────────────
  await prisma.purchaseOrder.create({
    data: {
      reference: 'PO-20250001', supplierId: acme.id, locationId: zoneA.id,
      status: POStatus.RECEIVED, orderDate: new Date('2025-09-06'), receivedDate: new Date('2025-09-08'),
      notes: 'Q3 restock — steel and sheets',
      lines: { create: [
        { productId: steelRods.id, quantity: 100, unitPrice: 3.64, receivedQty: 100 },
        { productId: alSheets.id,  quantity: 50,  unitPrice: 3.64, receivedQty: 50  },
      ]},
    },
  });

  await prisma.purchaseOrder.create({
    data: {
      reference: 'PO-20250002', supplierId: metalSupply.id, locationId: zoneA.id,
      status: POStatus.OPEN, orderDate: new Date('2025-09-04'), expectedDate: new Date('2025-09-15'),
      lines: { create: [
        { productId: copperWire.id, quantity: 200, unitPrice: 0.70 },
        { productId: bearings.id,   quantity: 200, unitPrice: 0.70 },
      ]},
    },
  });

  await prisma.purchaseOrder.create({
    data: {
      reference: 'PO-20250003', supplierId: globalParts.id, locationId: zoneA.id,
      status: POStatus.PARTIALLY_RECEIVED, orderDate: new Date('2025-09-02'), expectedDate: new Date('2025-09-12'),
      lines: { create: [
        { productId: hydraulic.id, quantity: 80, unitPrice: 1.80, receivedQty: 40 },
        { productId: gloves.id,    quantity: 80, unitPrice: 1.80, receivedQty: 0  },
      ]},
    },
  });

  await prisma.purchaseOrder.create({
    data: {
      reference: 'PO-20250004', supplierId: acme.id,
      status: POStatus.DRAFT, orderDate: new Date('2025-09-10'),
      lines: { create: [{ productId: steelRods6.id, quantity: 500, unitPrice: 2.20 }] },
    },
  });

  await prisma.purchaseOrder.create({
    data: {
      reference: 'PO-20250005', supplierId: metalSupply.id,
      status: POStatus.CANCELED, orderDate: new Date('2025-08-29'),
      notes: 'Canceled — supplier unavailable',
      lines: { create: [{ productId: copperWire.id, quantity: 400, unitPrice: 1.575 }] },
    },
  });

  console.log('  ✓ Purchase orders');

  // ── Sales Orders (sequential) ──────────────────────────────────────────────
  await prisma.salesOrder.create({
    data: {
      reference: 'SO-20250001', customerId: johnSmith.id, locationId: zoneB.id,
      status: SOStatus.OPEN, orderDate: new Date('2025-09-06'),
      lines: { create: [{ productId: chairs.id, quantity: 5, unitPrice: 150.00 }] },
    },
  });

  await prisma.salesOrder.create({
    data: {
      reference: 'SO-20250002', customerId: janeLee.id, locationId: zoneA.id,
      status: SOStatus.PARTIALLY_FULFILLED, orderDate: new Date('2025-09-05'),
      lines: { create: [
        { productId: steelRods6.id, quantity: 100, unitPrice: 4.50, fulfilledQty: 50 },
        { productId: alSheets.id,   quantity: 20,  unitPrice: 8.00, fulfilledQty: 0  },
      ]},
    },
  });

  await prisma.salesOrder.create({
    data: {
      reference: 'SO-20250003', customerId: acmeRetail.id, locationId: zoneB.id,
      status: SOStatus.FULFILLED, orderDate: new Date('2025-09-04'), shippedDate: new Date('2025-09-05'),
      lines: { create: [
        { productId: chairs.id,   quantity: 10, unitPrice: 150.00, fulfilledQty: 10 },
        { productId: bearings.id, quantity: 50, unitPrice: 2.50,   fulfilledQty: 50 },
      ]},
    },
  });

  await prisma.salesOrder.create({
    data: {
      reference: 'SO-20250004', customerId: blueMart.id,
      status: SOStatus.CANCELED, orderDate: new Date('2025-09-03'),
      notes: 'Canceled by customer',
      lines: { create: [{ productId: alSheets.id, quantity: 30, unitPrice: 8.00 }] },
    },
  });

  await prisma.salesOrder.create({
    data: {
      reference: 'SO-20250005', customerId: johnSmith.id, locationId: zoneA.id,
      status: SOStatus.OPEN, orderDate: new Date('2025-09-02'),
      lines: { create: [{ productId: hydraulic.id, quantity: 10, unitPrice: 12.00 }] },
    },
  });

  console.log('  ✓ Sales orders');

  // ── Stock Movements (sequential) ───────────────────────────────────────────
  await prisma.stockMovement.create({ data: { productId: steelRods.id,  type: MovementType.IN,         quantity: 200,  reference: 'REC-0291',    userId: admin.id, note: 'Received from AcmeCorp'        } });
  await prisma.stockMovement.create({ data: { productId: alSheets.id,   type: MovementType.IN,         quantity: 80,   reference: 'REC-0291',    userId: admin.id                                         } });
  await prisma.stockMovement.create({ data: { productId: bearings.id,   type: MovementType.TRANSFER,   quantity: 150,  reference: 'TRF-0103',    userId: admin.id, note: 'Main WH → Production Rack'      } });
  await prisma.stockMovement.create({ data: { productId: hydraulic.id,  type: MovementType.ADJUSTMENT, quantity: -3,   reference: 'ADJ-0067',    userId: admin.id, note: 'Damaged goods'                  } });
  await prisma.stockMovement.create({ data: { productId: steelRods.id,  type: MovementType.IN,         quantity: 100,  reference: 'PO-20250001', userId: admin.id, note: 'Received from PO PO-20250001'   } });
  await prisma.stockMovement.create({ data: { productId: alSheets.id,   type: MovementType.IN,         quantity: 50,   reference: 'PO-20250001', userId: admin.id, note: 'Received from PO PO-20250001'   } });
  await prisma.stockMovement.create({ data: { productId: chairs.id,     type: MovementType.OUT,        quantity: 10,   reference: 'SO-20250003', userId: staff.id, note: 'Fulfilled for SO SO-20250003'    } });
  await prisma.stockMovement.create({ data: { productId: bearings.id,   type: MovementType.OUT,        quantity: 50,   reference: 'SO-20250003', userId: staff.id, note: 'Fulfilled for SO SO-20250003'    } });
  await prisma.stockMovement.create({ data: { productId: steelRods6.id, type: MovementType.OUT,        quantity: 50,   reference: 'SO-20250002', userId: staff.id, note: 'Partial fulfillment SO-20250002' } });

  console.log('  ✓ Stock movements');

  console.log('');
  console.log('✅ Seed complete!');
  console.log('');
  console.log('   👑  Admin  →  admin@coreinventory.com  /  Admin@123');
  console.log('   👤  Staff  →  sarah@coreinventory.com  /  Staff@123');
  console.log('');
  console.log('   Seeded: 2 warehouses · 4 zones · 8 products · 3 suppliers');
  console.log('           4 customers · 5 purchase orders · 5 sales orders · 9 movements');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });