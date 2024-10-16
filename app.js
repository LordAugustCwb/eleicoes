from flask import Flask, render_template, request
from sqlalchemy import create_engine, text

app = Flask(__name__)

# Configurações do banco de dados
server = 'NoteGus'
database = 'eleicao2024'
connection_string = f'mssql+pyodbc://{server}/{database}?driver=ODBC+Driver+17+for+SQL+Server'

# Criação da engine
engine = create_engine(connection_string)

def get_municipios():
    query = text("SELECT DISTINCT NM_MUNICIPIO FROM votacao_secao2024 ORDER BY NM_MUNICIPIO")
    with engine.connect() as conn:
        municipios = conn.execute(query).fetchall()
    return [municipio[0] for municipio in municipios]

def get_candidatos(municipio):
    query = text("""
        SELECT NR_VOTAVEL, NM_VOTAVEL
        FROM votacao_secao2024
        WHERE NM_MUNICIPIO = :municipio
        GROUP BY NR_VOTAVEL, NM_VOTAVEL
        ORDER BY NM_VOTAVEL  -- Ordenação alfabética
    """)
    with engine.connect() as conn:
        candidatos = conn.execute(query, {'municipio': municipio}).fetchall()
    return candidatos

def get_total_votos(municipio, nr_votavel):
    query = text("""
        SELECT SUM(QT_VOTOS) AS total_votos
        FROM votacao_secao2024
        WHERE NR_VOTAVEL = :nr_votavel AND NM_MUNICIPIO = :municipio
    """)
    with engine.connect() as conn:
        result = conn.execute(query, {'nr_votavel': nr_votavel, 'municipio': municipio}).fetchone()
    return result[0] if result else 0

@app.route('/', methods=['GET', 'POST'])
def index():
    total_votos = 0
    municipios = get_municipios()
    candidatos = []

    if request.method == 'POST':
        municipio = request.form['municipio']
        nr_votavel = request.form.get('candidato')

        if nr_votavel:
            total_votos = get_total_votos(municipio, nr_votavel)

        # Carrega os candidatos apenas após a seleção do município
        candidatos = get_candidatos(municipio)

    return render_template('index.html', total_votos=total_votos, municipios=municipios, candidatos=candidatos)

@app.route('/votos_secao', methods=['POST'])
def votos_secao():
    municipio = request.form['municipio']
    nr_votavel = request.form['candidato']
    
    query = text("""
        SELECT NR_LOCAL_VOTACAO, SUM(QT_VOTOS) AS total_votos
        FROM votacao_secao2024
        WHERE NR_VOTAVEL = :nr_votavel AND NM_MUNICIPIO = :municipio
        GROUP BY NR_LOCAL_VOTACAO
        ORDER BY total_votos DESC  -- Ordena por total de votos em ordem decrescente
    """)
    with engine.connect() as conn:
        votos_por_secao = conn.execute(query, {'nr_votavel': nr_votavel, 'municipio': municipio}).fetchall()

    # Passando o nome do candidato para o template
    candidato_nome = get_nome_candidato(nr_votavel)
    return render_template('votos_secoes.html', votos=votos_por_secao, candidato=candidato_nome, municipio=municipio)



@app.route('/votos_colegio', methods=['POST'])
def votos_colegio():
    municipio = request.form['municipio']
    nr_votavel = request.form['candidato']

    query = text("""
        SELECT NM_LOCAL_VOTACAO, SUM(QT_VOTOS) AS total_votos
        FROM votacao_secao2024
        WHERE NR_VOTAVEL = :nr_votavel AND NM_MUNICIPIO = :municipio
        GROUP BY NM_LOCAL_VOTACAO
        ORDER BY total_votos DESC
    """)
    with engine.connect() as conn:
        votos_por_colegio = conn.execute(query, {'nr_votavel': nr_votavel, 'municipio': municipio}).fetchall()

    # Passando o nome do candidato e do município para o template
    candidato_nome = get_nome_candidato(nr_votavel)  # Função para obter o nome do candidato
    return render_template('votos_colegios.html', votos=votos_por_colegio, candidato=candidato_nome, municipio=municipio)

def get_nome_candidato(nr_votavel):
    query = text("SELECT NM_VOTAVEL FROM votacao_secao2024 WHERE NR_VOTAVEL = :nr_votavel")
    with engine.connect() as conn:
        result = conn.execute(query, {'nr_votavel': nr_votavel}).fetchone()
    return result[0] if result else "Candidato não encontrado"


@app.route('/candidatos', methods=['GET'])
def candidatos():
    municipio = request.args.get('municipio')
    candidatos = get_candidatos(municipio)
    return {
        'candidatos': [{'nr_votavel': candidato[0], 'nm_votavel': candidato[1]} for candidato in candidatos]
    }

@app.route('/total_votos', methods=['GET'])
def total_votos():
    municipio = request.args.get('municipio')
    nr_votavel = request.args.get('candidato')
    
    total = get_total_votos(municipio, nr_votavel)
    return {'total_votos': total}

if __name__ == '__main__':
    app.run(debug=True)
