"""Genera el PDF de una entrada con su código QR."""
from datetime import datetime
from pathlib import Path

import qrcode
from reportlab.lib.pagesizes import A6, landscape
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


def generar_pdf(ruta: Path, entrada: dict) -> None:
    ancho, alto = landscape(A6)
    c = canvas.Canvas(str(ruta), pagesize=(ancho, alto))

    # Encabezado
    c.setFillColorRGB(0.1, 0.2, 0.45)
    c.rect(0, alto - 14 * mm, ancho, 14 * mm, fill=1, stroke=0)
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(6 * mm, alto - 9.5 * mm, "EntradasYa")
    c.setFont("Helvetica", 9)
    c.drawRightString(ancho - 6 * mm, alto - 9.5 * mm, f"Entrada {entrada['numero']}")

    # Datos del evento
    fecha = entrada["fecha"]
    if isinstance(fecha, datetime):
        fecha = fecha.strftime("%d/%m/%Y %H:%M")
    c.setFillColorRGB(0, 0, 0)
    y = alto - 24 * mm
    c.setFont("Helvetica-Bold", 13)
    c.drawString(6 * mm, y, str(entrada["evento"])[:40])
    c.setFont("Helvetica", 10)
    for texto in (
        f"Fecha: {fecha}",
        f"Lugar: {entrada['lugar']}",
        f"Sector: {entrada['sector']}",
        f"Precio: {float(entrada['precio']):.2f}",
        f"Orden: {entrada['orden_id']}",
    ):
        y -= 7 * mm
        c.drawString(6 * mm, y, texto[:48])

    # Código QR con el código de la entrada
    qr = qrcode.make(entrada["codigo"]).get_image()
    lado = 42 * mm
    c.drawImage(ImageReader(qr), ancho - lado - 5 * mm, 12 * mm, lado, lado)
    c.setFont("Courier-Bold", 10)
    c.drawCentredString(ancho - lado / 2 - 5 * mm, 7 * mm, entrada["codigo"])

    c.setFont("Helvetica", 7)
    c.setFillColorRGB(0.4, 0.4, 0.4)
    c.drawString(6 * mm, 6 * mm, "Presente este QR en la puerta. Válida para un solo ingreso.")
    c.save()
