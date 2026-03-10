# Configurazione Home Assistant

## Automazione - Chiama il backend quando suona il campanello

Aggiungi in `configuration.yaml` oppure crea via UI (Automazioni):

```yaml
automation:
  - alias: "Citofono - Notifica backend al suono"
    trigger:
      - platform: state
        entity_id: binary_sensor.campanello   # <-- cambia con il tuo sensore campanello
        to: "on"
    action:
      - service: rest_command.doorbell_ring

rest_command:
  doorbell_ring:
    url: "http://192.168.1.6:8000/api/v1/ring"
    method: POST
    headers:
      Content-Type: "application/json"
```

## Script alternativo (se usi pulsante virtuale)

Se hai già un pulsante su HA che chiama la notifica,
aggiungi solo la chiamata REST nell'azione esistente:

```yaml
- service: rest_command.doorbell_ring
```

## Test manuale da HA Developer Tools

POST → http://192.168.1.6:8000/api/v1/ring

## URL WebApp
- Locale:  http://192.168.1.6:8000
- Pubblico: https://doorbell.dffm.it
