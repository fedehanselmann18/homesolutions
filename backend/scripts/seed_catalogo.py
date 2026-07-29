"""
Seed de catálogo (impuestos, categorías, categorías de gasto, proveedores,
productos con precio) -- datos de prueba variados de mano_obra/equipo/
materiales, con foco en instalación de aire acondicionado, para poder probar
el sistema con datos reales de punta a punta.

Idempotente: usa get-or-create por nombre/marca+modelo+proveedor, así se
puede correr de nuevo sin duplicar filas -- el precio y las categorías sí se
pisan con los valores de acá cada vez que se corre, para que sea fácil
ajustarlos reeditando este archivo.

Uso: desde backend/, con el venv activado:
    python -m scripts.seed_catalogo
"""

from app.db.db import SessionLocal
from app.db import models

IMPUESTOS = [
    "IVA",
    "Percepción de IVA",
    "Retención de Ganancias",
    "Ingresos Brutos",
    "Retención de Ingresos Brutos",
    "Percepción de Ingresos Brutos",
    "SUS",
]

CATEGORIAS_GASTO = [
    "Flete",
    "Reunión con cliente",
    "Gasto bancario",
    "Otros",
]

CATEGORIAS = [
    # equipo
    ("Aires Acondicionados", "equipo"),
    ("Ventilación", "equipo"),
    ("Televisores", "equipo"),
    ("Heladeras", "equipo"),
    ("Lavarropas", "equipo"),
    ("Aspiradoras", "equipo"),
    ("Hidrolavadoras", "equipo"),
    ("Herramientas Eléctricas", "equipo"),
    ("Aire Acondicionado", "equipo"),
    ("Electrodoméstico", "equipo"),
    ("Otros", "equipo"),
    # materiales
    ("Cables y Alambres", "materiales"),
    ("Caños de Cobre", "materiales"),
    ("Gas Refrigerante", "materiales"),
    ("Soportes y Fijaciones", "materiales"),
    ("Aislación Térmica", "materiales"),
    ("Accesorios Eléctricos", "materiales"),
    ("Cerámicos y Porcelanatos", "materiales"),
    ("Cables", "materiales"),
    ("Cinta", "materiales"),
    # mano_obra
    ("Instalación de Aire Acondicionado", "mano_obra"),
    ("Instalación Eléctrica", "mano_obra"),
    ("Instalación Sanitaria", "mano_obra"),
    ("Colocación de Pisos y Revestimientos", "mano_obra"),
    ("Pintura", "mano_obra"),
    ("Mantenimiento y Service", "mano_obra"),
    ("Plomero", "mano_obra"),
    ("Electricista", "mano_obra"),
    ("Instalador de Caños", "mano_obra"),
]

PROVEEDORES = [
    # nombre, cuit, direccion, telefono, email
    ("Sika Argentina", "30-50001111-1", "Ruta Panamericana Km 30, Bs.As.", "011-4100-1000", "ventas@sika.com.ar"),
    ("Weber Saint-Gobain", "30-50002222-2", "Av. Libertador 4500, CABA", "011-4100-2000", "ventas@weber.com.ar"),
    ("Ferrum", "30-50003333-3", "Av. Mitre 900, Avellaneda", "011-4100-3000", "ventas@ferrum.com.ar"),
    ("FV", "30-50004444-4", "Av. Warnes 1300, CABA", "011-4100-4000", "ventas@fv.com.ar"),
    ("Acindar", "30-50005555-5", "Ruta 9 Km 260, Villa Constitución", "011-4100-5000", "ventas@acindar.com.ar"),
    ("BGH", "30-50123456-1", "Av. Corrientes 1234, CABA", "011-4000-1000", "ventas@bgh.com.ar"),
    ("Surrey", "30-50234567-2", "Av. San Martín 2200, CABA", "011-4000-2000", "ventas@surrey.com.ar"),
    ("Prysmian Cables", "30-50345678-3", "Parque Ind. Garín, Bs.As.", "011-4000-3000", "ventas@prysmian.com.ar"),
    ("CobreSur Materiales", "30-50456789-4", "Av. Roca 800, Avellaneda", "011-4000-4000", "ventas@cobresur.com.ar"),
    ("ClimaTotal Instalaciones", "30-50567890-5", "Av. Rivadavia 5500, CABA", "011-4000-5000", "contacto@climatotal.com.ar"),
]

# marca, modelo, tipo, proveedor_nombre, precio, [categorias]
PRODUCTOS = [
    # --- Catálogo original (Sika/Weber/Ferrum/FV/Acindar) ---
    ("Bosch", "Taladro Percutor GSB 13 RE", "equipo", "Sika Argentina", 130000, ["Herramientas Eléctricas"]),
    ("DeWalt", "Amoladora DWE4212", "equipo", "Sika Argentina", 95000, ["Herramientas Eléctricas"]),
    ("Samsung", "Heladera RT38", "equipo", "Ferrum", 650000, ["Heladeras"]),
    ("LG", "Lavarropas WM85", "equipo", "Ferrum", 720000, ["Lavarropas"]),
    ("Philips", "Aspiradora PowerPro", "equipo", "Acindar", 210000, ["Aspiradoras"]),
    ("Black+Decker", "Hidrolavadora BW13", "equipo", "Acindar", 185000, ["Hidrolavadoras"]),
    ("Servicio", "Instalación de Cerámicos", "mano_obra", "Weber Saint-Gobain", 45000, ["Colocación de Pisos y Revestimientos"]),
    ("Servicio", "Colocación de Porcelanato", "mano_obra", "Weber Saint-Gobain", 55000, ["Colocación de Pisos y Revestimientos"]),
    ("Servicio", "Instalación Eléctrica", "mano_obra", "FV", 60000, ["Instalación Eléctrica"]),
    ("Servicio", "Instalación Sanitaria", "mano_obra", "FV", 65000, ["Instalación Sanitaria"]),

    # --- BGH / Surrey / Prysmian / CobreSur / ClimaTotal ---
    ("BGH", "Aire Acondicionado Split Frío/Calor 3000W", "equipo", "BGH", 550000, ["Aires Acondicionados"]),
    ("BGH", "Aire Acondicionado Split Frío/Calor 4500W", "equipo", "BGH", 780000, ["Aires Acondicionados"]),
    ("BGH", "Televisor LED 50\" 4K", "equipo", "BGH", 620000, ["Televisores"]),
    ("Surrey", "Aire Acondicionado Split Inverter 2250W", "equipo", "Surrey", 480000, ["Aires Acondicionados"]),
    ("Surrey", "Ventilador de Techo Industrial", "equipo", "Surrey", 95000, ["Ventilación"]),
    ("Prysmian", "Cable Unipolar 2.5mm x 100m", "materiales", "Prysmian Cables", 45000, ["Cables y Alambres"]),
    ("Prysmian", "Cable Unipolar 4mm x 100m", "materiales", "Prysmian Cables", 68000, ["Cables y Alambres"]),
    ("Prysmian", "Alambre de Cobre 1.5mm x 100m", "materiales", "Prysmian Cables", 32000, ["Cables y Alambres"]),
    ("CobreSur", "Caño de Cobre 1/4\" x 15m", "materiales", "CobreSur Materiales", 38000, ["Caños de Cobre"]),
    ("CobreSur", "Caño de Cobre 3/8\" x 15m", "materiales", "CobreSur Materiales", 52000, ["Caños de Cobre"]),
    ("CobreSur", "Gas Refrigerante R410A 11.3kg", "materiales", "CobreSur Materiales", 145000, ["Gas Refrigerante"]),
    ("CobreSur", "Soporte para Split Pared", "materiales", "CobreSur Materiales", 18000, ["Soportes y Fijaciones"]),
    ("CobreSur", "Aislación Térmica Armaflex 3/8\"", "materiales", "CobreSur Materiales", 12000, ["Aislación Térmica"]),
    ("Servicio", "Instalación de Aire Acondicionado Split", "mano_obra", "ClimaTotal Instalaciones", 85000, ["Instalación de Aire Acondicionado"]),
    ("Servicio", "Mantenimiento de Aire Acondicionado", "mano_obra", "ClimaTotal Instalaciones", 35000, ["Mantenimiento y Service"]),
    ("Servicio", "Tendido de Cableado Eléctrico", "mano_obra", "ClimaTotal Instalaciones", 50000, ["Instalación Eléctrica"]),

    # --- Datos de prueba: aire_acondicionado / electrodomestico / otros / cables / cinta /
    #     plomero / electricista / instalador de caños -- repartidos entre TODOS los proveedores ---
    ("BGH", "Aire Acondicionado Split 2750W Frío/Calor", "equipo", "BGH", 510000, ["Aire Acondicionado"]),
    ("BGH", "Heladera No Frost 320L", "equipo", "BGH", 590000, ["Electrodoméstico"]),
    ("Surrey", "Aire Acondicionado de Ventana 3500W", "equipo", "Surrey", 390000, ["Aire Acondicionado"]),
    ("Surrey", "Purificador de Aire con Filtro HEPA", "equipo", "Surrey", 150000, ["Electrodoméstico"]),
    ("Ferrum", "Aire Acondicionado Portátil 2200 Frigorías", "equipo", "Ferrum", 420000, ["Aire Acondicionado"]),
    ("Ferrum", "Microondas Digital 25L", "equipo", "Ferrum", 180000, ["Electrodoméstico"]),
    ("Ferrum", "Service de Plomero para Griferías", "mano_obra", "Ferrum", 30000, ["Plomero"]),
    ("Weber Saint-Gobain", "Ventilador de Pie Industrial", "equipo", "Weber Saint-Gobain", 95000, ["Otros"]),
    ("Weber Saint-Gobain", "Instalador de Caños Pluviales", "mano_obra", "Weber Saint-Gobain", 42000, ["Instalador de Caños"]),
    ("Acindar", "Grupo Electrógeno Portátil", "equipo", "Acindar", 350000, ["Otros"]),
    ("Acindar", "Cable de Acero Galvanizado 5mm x 50m", "materiales", "Acindar", 45000, ["Cables"]),
    ("Sika Argentina", "Compresor de Aire 50L", "equipo", "Sika Argentina", 210000, ["Otros"]),
    ("Sika Argentina", "Cinta Aisladora 3M Profesional", "materiales", "Sika Argentina", 8000, ["Cinta"]),
    ("Sika Argentina", "Instalador de Caños PVC", "mano_obra", "Sika Argentina", 40000, ["Instalador de Caños"]),
    ("Prysmian", "Cable Bajo Consumo 2x1.5mm x 50m", "materiales", "Prysmian Cables", 28000, ["Cables"]),
    ("Prysmian", "Cinta Aislante Eléctrica 3M", "materiales", "Prysmian Cables", 5000, ["Cinta"]),
    ("CobreSur", "Cinta Teflón para Gasista", "materiales", "CobreSur Materiales", 2500, ["Cinta"]),
    ("CobreSur", "Cable Cinta Plana Multipar", "materiales", "CobreSur Materiales", 40000, ["Cables"]),
    ("FV", "Cinta Aisladora Doble Faz", "materiales", "FV", 6000, ["Cinta"]),
    ("FV", "Service de Electricista Industrial", "mano_obra", "FV", 65000, ["Electricista"]),
    ("ClimaTotal Instalaciones", "Service de Plomero Sanitario", "mano_obra", "ClimaTotal Instalaciones", 32000, ["Plomero"]),
    ("ClimaTotal Instalaciones", "Service de Electricista Domiciliario", "mano_obra", "ClimaTotal Instalaciones", 48000, ["Electricista"]),
    ("ClimaTotal Instalaciones", "Instalador de Caños de Gas", "mano_obra", "ClimaTotal Instalaciones", 60000, ["Instalador de Caños"]),
]


def get_or_create(db, model, defaults=None, **kwargs):
    instancia = db.query(model).filter_by(**kwargs).first()
    if instancia:
        return instancia, False
    instancia = model(**kwargs, **(defaults or {}))
    db.add(instancia)
    db.flush()
    return instancia, True


def main():
    db = SessionLocal()
    creados = {"impuestos": 0, "categorias_gasto": 0, "categorias": 0, "proveedores": 0, "productos": 0}
    try:
        for nombre in IMPUESTOS:
            _, nuevo = get_or_create(db, models.Impuesto, nombre=nombre)
            creados["impuestos"] += int(nuevo)

        for nombre in CATEGORIAS_GASTO:
            _, nuevo = get_or_create(db, models.CategoriaGasto, nombre=nombre)
            creados["categorias_gasto"] += int(nuevo)

        categoria_por_nombre = {}
        for nombre, tipo in CATEGORIAS:
            cat, nuevo = get_or_create(db, models.Categoria, nombre=nombre, defaults={"tipo": tipo})
            categoria_por_nombre[nombre] = cat
            creados["categorias"] += int(nuevo)

        proveedor_por_nombre = {}
        for nombre, cuit, direccion, telefono, email in PROVEEDORES:
            prov, nuevo = get_or_create(
                db, models.Proveedor, nombre=nombre,
                defaults={"cuit": cuit, "direccion": direccion, "telefono": telefono, "email": email},
            )
            proveedor_por_nombre[nombre] = prov
            creados["proveedores"] += int(nuevo)

        for marca, modelo, tipo, proveedor_nombre, precio, categorias in PRODUCTOS:
            proveedor = proveedor_por_nombre[proveedor_nombre]
            prod, nuevo = get_or_create(
                db, models.Producto, marca=marca, modelo=modelo, proveedor_id=proveedor.id,
                defaults={"tipo": tipo, "precio": precio},
            )
            creados["productos"] += int(nuevo)
            prod.precio = precio
            for cat_nombre in categorias:
                cat = categoria_por_nombre[cat_nombre]
                if cat not in prod.categorias:
                    prod.categorias.append(cat)

        db.commit()
        print("Seed OK:", creados)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
