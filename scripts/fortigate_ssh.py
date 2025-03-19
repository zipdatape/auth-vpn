import paramiko
import re
import json
import sys
import os
from dotenv import load_dotenv

# Load environment variables from .env.local
load_dotenv(dotenv_path='.env.local')

def ejecutar_comando(ssh_client, comando):
    stdin, stdout, stderr = ssh_client.exec_command(comando)
    salida = stdout.read().decode()
    return salida

def get_group_members(group_name):
    # Get configuration from environment variables
    hostname = os.getenv('FORTIGATE_IP')
    puerto = int(os.getenv('FORTIGATE_SSH_PORT', 22))
    usuario = os.getenv('FORTIGATE_SSH_USERNAME')
    clave = os.getenv('FORTIGATE_SSH_PASSWORD')

    # Check if all required environment variables are set
    if not all([hostname, usuario, clave]):
        return json.dumps({"error": "Missing required environment variables"})

    try:
        # Establecer conexión SSH
        ssh_client = paramiko.SSHClient()
        ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh_client.connect(hostname, username=usuario, password=clave, port=puerto)

        # Ejecutar comandos
        comando = f"config user group\nedit \"{group_name}\"\nshow\nend"
        salida_comando = ejecutar_comando(ssh_client, comando)

        # Analizar la salida para encontrar los miembros
        miembros = []

        # Buscar los miembros en la salida
        match = re.search(r'set member(.*?)$', salida_comando, re.MULTILINE | re.DOTALL)
        if match:
            members_string = match.group(1).strip()
            miembros = re.findall(r'"([^"]+)"', members_string)

        # Crear un diccionario con el grupo y los miembros
        resultado = {
            "group": group_name,
            "members": miembros
        }

        return json.dumps(resultado)
    except Exception as e:
        return json.dumps({"error": str(e)})
    finally:
        # Cerrar la conexión SSH
        if 'ssh_client' in locals():
            ssh_client.close()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        print(get_group_members(sys.argv[1]))
    else:
        print(json.dumps({"error": "No group name provided"}))

